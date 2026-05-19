import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Integration test for POST /api/safepay/confirm-payment.
 *
 * We mock lib/firebase-admin so no real Firebase access happens, then
 * exercise the route handler end-to-end (auth → validation → transaction
 * → audit → response).
 *
 * Each test resets the mocks; we simulate different mission states and
 * caller roles to verify the state machine and RBAC enforcement.
 */

const mockVerifySessionCookie = vi.fn();
const mockTxGet               = vi.fn();
const mockTxUpdate            = vi.fn();
const mockTxSet               = vi.fn();
const mockRunTransaction      = vi.fn();
const mockAuditAdd            = vi.fn();
const mockDocRef              = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => ({
        id:  id ?? `auto_${Math.random().toString(36).slice(2, 10)}`,
        get: mockTxGet,
        update: mockTxUpdate,
      }),
      add: name === 'audit_logs' ? mockAuditAdd : vi.fn(),
    }),
    runTransaction: mockRunTransaction,
  }),
  adminStorage: () => ({}),
}));

/* The route imports the helpers AND the env validator AND the rate
   limiter — we let those run for real. Only the Admin SDK is mocked. */

import { POST } from '@/app/api/safepay/confirm-payment/route';

function makeReq(body: unknown, opts?: { sessionCookie?: string }): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  const req = new NextRequest('http://test/api/safepay/confirm-payment', {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
  if (opts?.sessionCookie !== null) {
    req.cookies.set('__session', opts?.sessionCookie ?? 'valid-session-cookie-fake');
  }
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  /* By default: caller is super-admin, mission is in pending_office state
     with amount=15000 and a clientId. Transaction commits the function
     by calling it directly with a mock tx object. */
  mockVerifySessionCookie.mockResolvedValue({
    uid:   'admin-uid',
    email: 'admin@maawa.test',
    admin: true,
    role:  'super',
  });

  mockRunTransaction.mockImplementation(async (fn) => {
    const tx = {
      get:    mockTxGet,
      update: mockTxUpdate,
      set:    mockTxSet,
    };
    return fn(tx);
  });

  mockTxGet.mockResolvedValue({
    exists: true,
    data:   () => ({
      status:   'pending_office',
      amount:   15000,
      clientId: 'client-uid',
    }),
  });
});

describe('POST /api/safepay/confirm-payment', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const req = new NextRequest('http://test/api/safepay/confirm-payment', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({}),
    });
    /* No __session cookie set */
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('UNAUTHENTICATED');
  });

  it('rejects non-admin users with 403', async () => {
    mockVerifySessionCookie.mockResolvedValueOnce({
      uid: 'plain-user',
      email: 'u@maawa.test',
      admin: false,
      role:  null,
    });
    const res = await POST(makeReq({
      missionId: 'aB1cD2eF3gH4iJ5kL6mN7oP8',
      amount:    15000,
      method:    'cash',
    }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('FORBIDDEN');
  });

  it('rejects malformed body with 400', async () => {
    const res = await POST(makeReq({ missionId: 'short', amount: 'not-a-number' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('BAD_REQUEST');
  });

  it('rejects amount mismatch without acceptDiscrepancy=true', async () => {
    const res = await POST(makeReq({
      missionId: 'aB1cD2eF3gH4iJ5kL6mN7oP8',
      amount:    9999,        /* mission expects 15000 */
      method:    'cash',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toMatch(/Amount mismatch/);
  });

  it('accepts amount mismatch when acceptDiscrepancy=true', async () => {
    const res = await POST(makeReq({
      missionId:         'aB1cD2eF3gH4iJ5kL6mN7oP8',
      amount:            14000,
      method:            'cash',
      acceptDiscrepancy: true,
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    /* Verify the tx was written marking the discrepancy */
    expect(mockTxSet).toHaveBeenCalled();
    const setCall = mockTxSet.mock.calls[0]![1];
    expect(setCall.discrepancy).toBe(true);
    expect(setCall.amount).toBe(14000);
    expect(setCall.expected).toBe(15000);
  });

  it('rejects when mission is not in pending_office state', async () => {
    mockTxGet.mockResolvedValueOnce({
      exists: true,
      data:   () => ({ status: 'released', amount: 15000, clientId: 'c' }),
    });
    const res = await POST(makeReq({
      missionId: 'aB1cD2eF3gH4iJ5kL6mN7oP8',
      amount:    15000,
      method:    'cash',
    }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('CONFLICT');
    expect(json.message).toMatch(/not pending_office/);
  });

  it('rejects when mission does not exist', async () => {
    mockTxGet.mockResolvedValueOnce({ exists: false, data: () => null });
    const res = await POST(makeReq({
      missionId: 'aB1cD2eF3gH4iJ5kL6mN7oP8',
      amount:    15000,
      method:    'cash',
    }));
    expect(res.status).toBe(404);
  });

  it('writes mission update + transaction + audit on success', async () => {
    const res = await POST(makeReq({
      missionId: 'aB1cD2eF3gH4iJ5kL6mN7oP8',
      amount:    15000,
      method:    'ccp',
      reference: 'CCP-12345',
    }));
    expect(res.status).toBe(200);

    /* Mission was updated to 'confirmed' */
    expect(mockTxUpdate).toHaveBeenCalled();
    const updateCall = mockTxUpdate.mock.calls[0]![1];
    expect(updateCall.status).toBe('confirmed');
    expect(updateCall.paidVia).toBe('ccp');
    expect(updateCall.paidReference).toBe('CCP-12345');
    expect(updateCall.lastUpdatedBy).toBe('admin-uid');

    /* Transaction row was created */
    expect(mockTxSet).toHaveBeenCalled();
    const txDocPayload = mockTxSet.mock.calls[0]![1];
    expect(txDocPayload.kind).toBe('office_payment');
    expect(txDocPayload.userId).toBe('client-uid');
    expect(txDocPayload.recordedBy).toBe('admin-uid');

    /* Audit log entry was added */
    expect(mockAuditAdd).toHaveBeenCalled();
    const auditPayload = mockAuditAdd.mock.calls[0]![0];
    expect(auditPayload.action).toBe('safepay.confirm_payment');
    expect(auditPayload.actor).toBe('admin-uid');
  });
});
