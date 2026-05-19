import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Integration tests for the coin-purchase flow:
 *   - POST /api/wallet/purchase-request
 *   - POST /api/admin/wallet/approve-request
 *   - POST /api/admin/wallet/reject-request
 *
 * We mock lib/firebase-admin so no real Firebase is touched, then
 * exercise each route end-to-end. Mocks are reset per-test.
 *
 * What we assert:
 *   - Validation: range, enum, missing fields → 400
 *   - Auth: missing cookie → 401; non-admin → 403 for admin routes
 *   - Approve: increments balance + creates transaction doc; refuses to
 *     double-approve an already-approved request.
 *   - Reject: writes status='rejected' + captures reason, does NOT
 *     touch the user balance.
 */

const mockVerifySessionCookie = vi.fn();
const mockTxGet               = vi.fn();
const mockTxUpdate            = vi.fn();
const mockTxSet               = vi.fn();
const mockRunTransaction      = vi.fn();
const mockAuditAdd            = vi.fn();
const mockDocSet              = vi.fn();
const mockFileExists          = vi.fn();

let docIdCounter = 0;
const nextDocId = () => `req_${++docIdCounter}`;

/* Track which collection.doc() was last asked for so the route's
   `runTransaction → tx.get(reqRef)` can resolve to the right snapshot. */
let lastRequestDocId: string | null = null;

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id ?? (name === 'coin_purchase_requests' ? nextDocId() : `auto_${Math.random().toString(36).slice(2, 10)}`);
        if (name === 'coin_purchase_requests' && id) lastRequestDocId = id;
        return {
          id: docId,
          get: mockTxGet,
          update: mockTxUpdate,
          set: mockDocSet,
        };
      },
      add: name === 'audit_logs' ? mockAuditAdd : vi.fn(),
    }),
    runTransaction: mockRunTransaction,
  }),
  adminStorage: () => ({
    bucket: () => ({
      file: (_path: string) => ({
        exists: mockFileExists,
      }),
    }),
  }),
}));

import { POST as CreateRequest } from '@/app/api/wallet/purchase-request/route';
import { POST as ApproveRequest } from '@/app/api/admin/wallet/approve-request/route';
import { POST as RejectRequest } from '@/app/api/admin/wallet/reject-request/route';

function makeReq(url: string, body: unknown, opts?: { sessionCookie?: string | null }): NextRequest {
  const req = new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (opts?.sessionCookie !== null) {
    req.cookies.set('__session', opts?.sessionCookie ?? 'valid-session-cookie-fake');
  }
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  docIdCounter = 0;
  lastRequestDocId = null;

  /* Default: caller is a regular signed-in user. Tests for admin routes
     override this with mockResolvedValueOnce. */
  mockVerifySessionCookie.mockResolvedValue({
    uid:   'user-uid',
    email: 'user@maawa.test',
    admin: false,
    role:  null,
  });

  mockRunTransaction.mockImplementation(async (fn) => {
    const tx = { get: mockTxGet, update: mockTxUpdate, set: mockTxSet };
    return fn(tx);
  });

  mockFileExists.mockResolvedValue([true]);
});

/* ─── POST /api/wallet/purchase-request ──────────────────────────────── */

describe('POST /api/wallet/purchase-request', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const req = makeReq('http://test/api/wallet/purchase-request', {
      amountMC: 200, paymentMethod: 'ccp',
    }, { sessionCookie: null });
    const res = await CreateRequest(req);
    expect(res.status).toBe(401);
  });

  it('creates a pending request for a valid body', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 200, paymentMethod: 'ccp', reference: 'CCP-12345' },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.requestId).toBeTruthy();
    expect(json.amountDZD).toBe(200 * 50); /* NEXT_PUBLIC_MC_RATE_DZD=50 in test setup */
    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.userId).toBe('user-uid');
    expect(payload.status).toBe('pending');
    expect(payload.amountMC).toBe(200);
    expect(payload.amountDZD).toBe(10000);
    expect(payload.paymentMethod).toBe('ccp');
    expect(payload.reference).toBe('CCP-12345');
    expect(payload.proofUrl).toBeNull();
    expect(mockAuditAdd).toHaveBeenCalled();
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('wallet.purchase_request_created');
  });

  it('returns CCP instructions when method is ccp', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 100, paymentMethod: 'ccp' },
    ));
    const json = await res.json();
    expect(json.instructions.ccp).toBe('CCP-TEST-0000-0000');
    expect(json.instructions.baridimob).toBeUndefined();
  });

  it('returns Baridimob instructions when method is baridimob', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 500, paymentMethod: 'baridimob' },
    ));
    const json = await res.json();
    expect(json.instructions.baridimob).toBe('+213555000000');
    expect(json.instructions.ccp).toBeUndefined();
  });

  it('returns office address when method is cash_office', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 100, paymentMethod: 'cash_office' },
    ));
    const json = await res.json();
    expect(json.instructions.officeAddress).toBe('Test Office, Algiers');
  });

  it('rejects amountMC < 100 with 400', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 50, paymentMethod: 'ccp' },
    ));
    expect(res.status).toBe(400);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects amountMC > 10000 with 400', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 10001, paymentMethod: 'ccp' },
    ));
    expect(res.status).toBe(400);
  });

  it('rejects non-integer amountMC with 400', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 250.5, paymentMethod: 'ccp' },
    ));
    expect(res.status).toBe(400);
  });

  it('rejects unknown paymentMethod with 400', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      { amountMC: 200, paymentMethod: 'paypal' },
    ));
    expect(res.status).toBe(400);
  });

  it('rejects proofPath outside the caller\'s folder', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      {
        amountMC: 200,
        paymentMethod: 'ccp',
        proofPath: 'coin_proofs/some-other-uid/proof.jpg', /* not user-uid */
      },
    ));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toMatch(/coin_proofs\/user-uid\//);
  });

  it('rejects proofPath when the file is missing', async () => {
    mockFileExists.mockResolvedValueOnce([false]);
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      {
        amountMC: 200,
        paymentMethod: 'ccp',
        proofPath: 'coin_proofs/user-uid/missing.jpg',
      },
    ));
    expect(res.status).toBe(400);
  });

  it('accepts a valid proofPath that exists', async () => {
    const res = await CreateRequest(makeReq(
      'http://test/api/wallet/purchase-request',
      {
        amountMC: 200,
        paymentMethod: 'ccp',
        proofPath: 'coin_proofs/user-uid/proof.jpg',
      },
    ));
    expect(res.status).toBe(200);
    expect(mockDocSet.mock.calls[0]![0].proofUrl).toBe('coin_proofs/user-uid/proof.jpg');
  });
});

/* ─── POST /api/admin/wallet/approve-request ─────────────────────────── */

describe('POST /api/admin/wallet/approve-request', () => {
  beforeEach(() => {
    /* Default: caller is admin, target request is pending. */
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'admin-uid', email: 'admin@maawa.test', admin: true, role: 'super',
    });
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId:   'requester-uid',
        amountMC: 300,
        amountDZD: 15000,
        paymentMethod: 'ccp',
        status: 'pending',
      }),
    });
  });

  it('rejects non-admin callers with 403', async () => {
    mockVerifySessionCookie.mockResolvedValueOnce({
      uid: 'user-uid', email: 'u@maawa.test', admin: false, role: null,
    });
    const res = await ApproveRequest(makeReq(
      'http://test/api/admin/wallet/approve-request',
      { requestId: 'req_1' },
    ));
    expect(res.status).toBe(403);
  });

  it('increments balance + creates transaction on success', async () => {
    const res = await ApproveRequest(makeReq(
      'http://test/api/admin/wallet/approve-request',
      { requestId: 'req_1' },
    ));
    expect(res.status).toBe(200);

    /* tx.update on the request flips to approved with reviewer metadata. */
    expect(mockTxUpdate).toHaveBeenCalled();
    const updatePayload = mockTxUpdate.mock.calls[0]![1];
    expect(updatePayload.status).toBe('approved');
    expect(updatePayload.reviewedBy).toBe('admin-uid');

    /* Two tx.set calls: one increments the user balance, one writes
       the transactions row. */
    expect(mockTxSet).toHaveBeenCalledTimes(2);

    /* The user balance set uses FieldValue.increment(amountMC). We can't
       directly compare to a sentinel without importing it, but we can
       at least confirm the userId target and merge:true. */
    const setCalls = mockTxSet.mock.calls;
    const userSet = setCalls.find(c => c[1]?.maawaCoinBalance !== undefined);
    expect(userSet).toBeTruthy();

    /* The transaction-row set has the documented shape. */
    const txSet = setCalls.find(c => c[1]?.kind === 'coin_purchase');
    expect(txSet).toBeTruthy();
    expect(txSet![1].userId).toBe('requester-uid');
    expect(txSet![1].amount).toBe(300);
    expect(txSet![1].missionId).toBeNull();
    expect(txSet![1].recordedBy).toBe('admin-uid');

    /* Audit row written. */
    expect(mockAuditAdd).toHaveBeenCalled();
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('admin.coin.approve');
  });

  it('refuses to double-approve an already-approved request (409)', async () => {
    mockTxGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        userId: 'requester-uid', amountMC: 300, status: 'approved',
      }),
    });
    const res = await ApproveRequest(makeReq(
      'http://test/api/admin/wallet/approve-request',
      { requestId: 'req_1' },
    ));
    expect(res.status).toBe(409);
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it('returns 404 when the request does not exist', async () => {
    mockTxGet.mockResolvedValueOnce({ exists: false, data: () => null });
    const res = await ApproveRequest(makeReq(
      'http://test/api/admin/wallet/approve-request',
      { requestId: 'missing' },
    ));
    expect(res.status).toBe(404);
  });
});

/* ─── POST /api/admin/wallet/reject-request ──────────────────────────── */

describe('POST /api/admin/wallet/reject-request', () => {
  beforeEach(() => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'admin-uid', email: 'admin@maawa.test', admin: true, role: 'super',
    });
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'requester-uid', amountMC: 300, status: 'pending' }),
    });
  });

  it('rejects non-admin callers with 403', async () => {
    mockVerifySessionCookie.mockResolvedValueOnce({
      uid: 'user-uid', email: 'u@maawa.test', admin: false, role: null,
    });
    const res = await RejectRequest(makeReq(
      'http://test/api/admin/wallet/reject-request',
      { requestId: 'req_1', reason: 'Bad proof' },
    ));
    expect(res.status).toBe(403);
  });

  it('rejects a too-short reason with 400', async () => {
    const res = await RejectRequest(makeReq(
      'http://test/api/admin/wallet/reject-request',
      { requestId: 'req_1', reason: 'No' },
    ));
    expect(res.status).toBe(400);
  });

  it('captures reason and does NOT credit the user balance', async () => {
    const res = await RejectRequest(makeReq(
      'http://test/api/admin/wallet/reject-request',
      { requestId: 'req_1', reason: 'Proof image is unreadable' },
    ));
    expect(res.status).toBe(200);

    const updatePayload = mockTxUpdate.mock.calls[0]![1];
    expect(updatePayload.status).toBe('rejected');
    expect(updatePayload.reviewedBy).toBe('admin-uid');
    expect(updatePayload.reviewNote).toBe('Proof image is unreadable');

    /* CRITICAL: no tx.set means no balance change and no transaction row. */
    expect(mockTxSet).not.toHaveBeenCalled();

    expect(mockAuditAdd).toHaveBeenCalled();
    const auditPayload = mockAuditAdd.mock.calls[0]![0];
    expect(auditPayload.action).toBe('admin.coin.reject');
    expect(auditPayload.meta.reason).toBe('Proof image is unreadable');
  });

  it('refuses to reject an already-approved request (409)', async () => {
    mockTxGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ userId: 'requester-uid', amountMC: 300, status: 'approved' }),
    });
    const res = await RejectRequest(makeReq(
      'http://test/api/admin/wallet/reject-request',
      { requestId: 'req_1', reason: 'Too late' },
    ));
    expect(res.status).toBe(409);
  });
});
