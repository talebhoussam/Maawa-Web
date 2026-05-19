import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Group B integration tests:
 *   - /api/comments/create
 *   - /api/ratings/submit
 *   - /api/wallet/payout-request
 *   - /api/admin/wallet/approve-payout
 *   - /api/admin/wallet/reject-payout
 */

const mockVerifySessionCookie = vi.fn();
const mockPostGet      = vi.fn();
const mockMissionGet   = vi.fn();
const mockUserGet      = vi.fn();
const mockRatingGet    = vi.fn();
const mockReqGet       = vi.fn();
const mockUserSet      = vi.fn();
const mockPostSet      = vi.fn();
const mockMissionUpdate = vi.fn();
const mockReqSet       = vi.fn();
const mockTxnSet       = vi.fn();
const mockRatingSet    = vi.fn();
const mockCommentSet   = vi.fn();
const mockNotifAdd     = vi.fn();
const mockNotifSet     = vi.fn();
const mockAuditAdd     = vi.fn();
const mockOpenSnapEmpty = vi.fn();

const mockRunTransaction = vi.fn();

/* Track which kind of `tx.get` is needed via call order arrays — each
   test seeds the sequence it expects. */
let txGetQueue: Array<() => Promise<unknown>> = [];

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    runTransaction: mockRunTransaction,
    collection: (name: string) => {
      if (name === 'audit_logs')    return { add: mockAuditAdd };
      if (name === 'users') {
        return {
          doc: (_id: string) => ({ get: mockUserGet, set: mockUserSet }),
        };
      }
      if (name === 'feed_posts') {
        return {
          doc: (postId: string) => ({
            get: mockPostGet,
            set: mockPostSet,
            collection: (sub: string) => {
              if (sub === 'comments') {
                return { doc: (_cid?: string) => ({ id: 'cmt_x', set: mockCommentSet }) };
              }
              return {};
            },
          }),
        };
      }
      if (name === 'missions') {
        return {
          doc: (_id: string) => ({ get: mockMissionGet, update: mockMissionUpdate }),
        };
      }
      if (name === 'ratings') {
        return {
          doc: (_id: string) => ({ get: mockRatingGet, set: mockRatingSet }),
        };
      }
      if (name === 'payout_requests') {
        const collFns = {
          where: () => collFns,
          limit: () => ({ get: mockOpenSnapEmpty }),
          orderBy: () => collFns,
        };
        return {
          doc: (_id?: string) => ({
            id: `pr_${Math.random().toString(36).slice(2, 8)}`,
            get: mockReqGet,
            set: mockReqSet,
          }),
          ...collFns,
        };
      }
      if (name === 'transactions') {
        return { doc: (_id?: string) => ({ id: 'txn_x', set: mockTxnSet }) };
      }
      if (name === 'notifications') {
        return {
          add: mockNotifAdd,
          doc: (_id?: string) => ({ id: 'notif_x', set: mockNotifSet }),
        };
      }
      return { doc: () => ({}), add: vi.fn() };
    },
  }),
}));

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
  mockVerifySessionCookie.mockResolvedValue({
    uid: 'user-1', email: 'u@maawa.test', admin: false, role: null,
  });
  /* Default empty open-requests result for payout-request flow. */
  mockOpenSnapEmpty.mockResolvedValue({ empty: true });
  txGetQueue = [];
  mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      get: () => {
        const next = txGetQueue.shift();
        if (!next) throw new Error('Unexpected tx.get call (queue empty)');
        return next();
      },
      set:    (_ref: unknown, payload: unknown) => {
        /* Distinguish writes by inspecting payload shape. Ratings have
           `stars`, transactions have `kind`, mission updates use
           tx.update separately. */
        if (payload && typeof payload === 'object') {
          const p = payload as Record<string, unknown>;
          if ('stars' in p && 'kind' in p) return mockRatingSet(payload);
          if (p.kind === 'payout') return mockTxnSet(payload);
          if (p.kind === 'new_rating') return mockNotifSet(payload);
          if ('payableBalance' in p) return mockUserSet(payload);
          if ('status' in p && (p.status === 'approved' || p.status === 'rejected')) {
            return mockReqSet(payload);
          }
        }
        return mockReqSet(payload);
      },
      update: (_ref: unknown, payload: unknown) => mockMissionUpdate(payload),
    };
    return fn(tx);
  });
});

import { POST as CommentPOST }   from '@/app/api/comments/create/route';
import { POST as RatingPOST }    from '@/app/api/ratings/submit/route';
import { POST as PayoutReqPOST } from '@/app/api/wallet/payout-request/route';
import { POST as PayoutApprovePOST } from '@/app/api/admin/wallet/approve-payout/route';
import { POST as PayoutRejectPOST }  from '@/app/api/admin/wallet/reject-payout/route';

describe('POST /api/comments/create', () => {
  it('writes comment + bumps commentsCount + notifies post author', async () => {
    mockPostGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ authorId: 'author-uid', commenters: [] }),
    });
    mockUserGet.mockResolvedValueOnce({
      exists: true, data: () => ({ displayName: 'Alice' }),
    });

    const res = await CommentPOST(makeReq(
      'http://test/api/comments/create',
      { postId: 'p-1', text: 'Bravo !' },
    ));
    expect(res.status).toBe(200);

    /* Comment doc written with right shape. */
    expect(mockCommentSet).toHaveBeenCalledTimes(1);
    const c = mockCommentSet.mock.calls[0]![0];
    expect(c.authorId).toBe('user-1');
    expect(c.authorName).toBe('Alice');
    expect(c.text).toBe('Bravo !');

    /* Parent updated — commentsCount increment + commenters union. */
    expect(mockPostSet).toHaveBeenCalledTimes(1);
    const patch = mockPostSet.mock.calls[0]![0];
    expect(patch.commentsCount).toBeDefined();
    expect(patch.commenters).toBeDefined();

    /* Notif to author. */
    expect(mockNotifAdd).toHaveBeenCalled();
    expect(mockNotifAdd.mock.calls[0]![0].userId).toBe('author-uid');
    expect(mockNotifAdd.mock.calls[0]![0].kind).toBe('new_comment');
  });

  it('does not re-notify a returning commenter', async () => {
    mockPostGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ authorId: 'author-uid', commenters: ['user-1'] }),
    });
    mockUserGet.mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'Alice' }) });
    await CommentPOST(makeReq('http://test/api/comments/create', { postId: 'p-1', text: '2nd comment' }));
    expect(mockNotifAdd).not.toHaveBeenCalled();
  });

  it('rejects empty text with 400', async () => {
    const res = await CommentPOST(makeReq('http://test/api/comments/create', { postId: 'p-1', text: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects oversize text (>1000) with 400', async () => {
    const res = await CommentPOST(makeReq('http://test/api/comments/create', {
      postId: 'p-1', text: 'x'.repeat(1001),
    }));
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated with 401', async () => {
    const res = await CommentPOST(makeReq(
      'http://test/api/comments/create',
      { postId: 'p-1', text: 'hi' },
      { sessionCookie: null },
    ));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/ratings/submit', () => {
  it('client rates artisan: writes rating, recomputes avg, stamps clientRatedAt', async () => {
    txGetQueue = [
      async () => ({
        exists: true,
        data: () => ({
          clientId: 'user-1', artisanId: 'artisan-uid', status: 'terminee',
        }),
      }),
      async () => ({ exists: false }),  /* no prior rating */
      async () => ({
        exists: true,
        data: () => ({ rating: 4.0, reviewCount: 2 }),
      }),
    ];
    const res = await RatingPOST(makeReq(
      'http://test/api/ratings/submit',
      { missionId: 'mis-1', stars: 5, comment: 'Parfait' },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    /* Old avg 4.0 with count 2 → new mean = (4*2 + 5) / 3 = 4.33 → rounded to 4.3. */
    expect(json.newAvg).toBe(4.3);
    expect(json.newCount).toBe(3);

    /* Rating doc was written with correct kind + ratedId. */
    const rating = mockRatingSet.mock.calls[0]![0];
    expect(rating.kind).toBe('client_to_artisan');
    expect(rating.ratedId).toBe('artisan-uid');
    expect(rating.stars).toBe(5);

    /* Mission stamped with clientRatedAt (not artisanRatedAt). */
    const missionPatch = mockMissionUpdate.mock.calls[0]![0];
    expect(missionPatch.clientRatedAt).toBeTruthy();
    expect(missionPatch.artisanRatedAt).toBeUndefined();
  });

  it('rejects rating on non-terminee mission with 409', async () => {
    txGetQueue = [
      async () => ({
        exists: true,
        data: () => ({ clientId: 'user-1', artisanId: 'a', status: 'confirmed' }),
      }),
      async () => ({ exists: false }),
    ];
    const res = await RatingPOST(makeReq('http://test/api/ratings/submit', { missionId: 'm', stars: 5 }));
    expect(res.status).toBe(409);
  });

  it('rejects duplicate rating from same rater with 409', async () => {
    txGetQueue = [
      async () => ({
        exists: true,
        data: () => ({ clientId: 'user-1', artisanId: 'a', status: 'terminee' }),
      }),
      async () => ({ exists: true }),  /* prior rating doc exists */
    ];
    const res = await RatingPOST(makeReq('http://test/api/ratings/submit', { missionId: 'm', stars: 5 }));
    expect(res.status).toBe(409);
  });

  it('rejects rating by non-participant with 403', async () => {
    txGetQueue = [
      async () => ({
        exists: true,
        data: () => ({ clientId: 'someone', artisanId: 'else', status: 'terminee' }),
      }),
      async () => ({ exists: false }),
    ];
    const res = await RatingPOST(makeReq('http://test/api/ratings/submit', { missionId: 'm', stars: 5 }));
    expect(res.status).toBe(403);
  });

  it('rejects out-of-range stars with 400', async () => {
    const res = await RatingPOST(makeReq('http://test/api/ratings/submit', { missionId: 'm', stars: 7 }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/wallet/payout-request', () => {
  it('happy path writes pending request', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'artisan', payableBalance: 50_000 }),
    });
    const res = await PayoutReqPOST(makeReq(
      'http://test/api/wallet/payout-request',
      { amountDZD: 10_000, method: 'ccp', accountInfo: '1234567890 clé 12' },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.requestId).toBeTruthy();

    expect(mockReqSet).toHaveBeenCalled();
    const payload = mockReqSet.mock.calls[0]![0];
    expect(payload.userId).toBe('user-1');
    expect(payload.amountDZD).toBe(10_000);
    expect(payload.method).toBe('ccp');
    expect(payload.status).toBe('pending');

    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('payout.requested');
  });

  it('rejects non-artisan with 403', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'client', payableBalance: 50_000 }),
    });
    const res = await PayoutReqPOST(makeReq(
      'http://test/api/wallet/payout-request',
      { amountDZD: 5_000, method: 'ccp', accountInfo: '1234567890' },
    ));
    expect(res.status).toBe(403);
  });

  it('rejects when balance < amountDZD with 400', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'artisan', payableBalance: 500 }),
    });
    const res = await PayoutReqPOST(makeReq(
      'http://test/api/wallet/payout-request',
      { amountDZD: 5_000, method: 'ccp', accountInfo: '1234567890' },
    ));
    expect(res.status).toBe(400);
  });

  it('rejects when an open request already exists with 400', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'artisan', payableBalance: 50_000 }),
    });
    mockOpenSnapEmpty.mockResolvedValueOnce({ empty: false });
    const res = await PayoutReqPOST(makeReq(
      'http://test/api/wallet/payout-request',
      { amountDZD: 5_000, method: 'ccp', accountInfo: '1234567890' },
    ));
    expect(res.status).toBe(400);
  });

  it('rejects amount below 1000 DZD with 400', async () => {
    const res = await PayoutReqPOST(makeReq(
      'http://test/api/wallet/payout-request',
      { amountDZD: 999, method: 'ccp', accountInfo: '1234567890' },
    ));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/wallet/approve-payout', () => {
  beforeEach(() => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'admin-1', email: 'a@maawa.test', admin: true, role: 'super',
    });
  });

  it('debits balance + writes ledger entry on approve', async () => {
    txGetQueue = [
      async () => ({
        exists: true,
        data: () => ({ status: 'pending', userId: 'artisan-1', amountDZD: 10_000 }),
      }),
      async () => ({
        exists: true,
        data: () => ({ payableBalance: 50_000 }),
      }),
    ];
    const res = await PayoutApprovePOST(makeReq(
      'http://test/api/admin/wallet/approve-payout',
      { requestId: 'pr-1' },
    ));
    expect(res.status).toBe(200);
    /* User balance debited from 50k to 40k. */
    const userPatch = mockUserSet.mock.calls[0]![0];
    expect(userPatch.payableBalance).toBe(40_000);
    /* Ledger entry. */
    expect(mockTxnSet).toHaveBeenCalled();
    const txn = mockTxnSet.mock.calls[0]![0];
    expect(txn.kind).toBe('payout');
    expect(txn.amount).toBe(10_000);
    expect(txn.type).toBe('debit');
  });

  it('refuses when request is not pending with 409', async () => {
    txGetQueue = [
      async () => ({
        exists: true,
        data: () => ({ status: 'approved', userId: 'a', amountDZD: 1 }),
      }),
    ];
    const res = await PayoutApprovePOST(makeReq(
      'http://test/api/admin/wallet/approve-payout',
      { requestId: 'pr-1' },
    ));
    expect(res.status).toBe(409);
  });

  it('refuses when balance dropped below amount with 400', async () => {
    txGetQueue = [
      async () => ({
        exists: true,
        data: () => ({ status: 'pending', userId: 'artisan-1', amountDZD: 10_000 }),
      }),
      async () => ({
        exists: true,
        data: () => ({ payableBalance: 1_000 }),  /* dropped */
      }),
    ];
    const res = await PayoutApprovePOST(makeReq(
      'http://test/api/admin/wallet/approve-payout',
      { requestId: 'pr-1' },
    ));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/wallet/reject-payout', () => {
  beforeEach(() => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'admin-1', email: 'a@maawa.test', admin: true, role: 'super',
    });
  });

  it('flips status to rejected, never debits balance', async () => {
    mockReqGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'pending', userId: 'artisan-1', amountDZD: 10_000 }),
    });
    const res = await PayoutRejectPOST(makeReq(
      'http://test/api/admin/wallet/reject-payout',
      { requestId: 'pr-1', reason: 'Coordonnées invalides' },
    ));
    expect(res.status).toBe(200);
    expect(mockReqSet).toHaveBeenCalled();
    expect(mockReqSet.mock.calls[0]![0].status).toBe('rejected');
    expect(mockUserSet).not.toHaveBeenCalled();
    expect(mockTxnSet).not.toHaveBeenCalled();
  });

  it('rejects empty reason with 400', async () => {
    const res = await PayoutRejectPOST(makeReq(
      'http://test/api/admin/wallet/reject-payout',
      { requestId: 'pr-1', reason: '' },
    ));
    expect(res.status).toBe(400);
  });
});
