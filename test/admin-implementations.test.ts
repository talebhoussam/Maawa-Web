import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for the new admin routes shipped in the post-Group-C turn:
 *   - /api/admin/categories/upsert + /delete
 *   - /api/disputes/open + /api/admin/disputes/resolve
 *   - /api/admin/settings/update
 *   - /api/admin/users/unban
 *   - /api/admin/broadcast/send
 *   - /api/admin/ads/upsert + /delete
 */

const mockVerifySessionCookie = vi.fn();
const mockUpdateAuthUser = vi.fn();
const mockDocGet  = vi.fn();
const mockDocSet  = vi.fn();
const mockColAdd  = vi.fn();
const mockColGet  = vi.fn();
const mockWhereGet = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/firebase-admin', () => {
  /* The chain returned by .where()/.orderBy()/.limit() is a SEPARATE
     object from the collection itself — the collection's own .get()
     hits mockColGet (full-collection iteration like the broadcast
     route does), but chained queries hit mockWhereGet. */
  const buildChain = () => {
    const chain: Record<string, unknown> = {};
    chain.where   = () => chain;
    chain.limit   = () => chain;
    chain.orderBy = () => chain;
    chain.get     = () => mockWhereGet();
    return chain;
  };

  const docRef = (id?: string) => ({
    id: id ?? `doc_${Math.random().toString(36).slice(2, 8)}`,
    get: mockDocGet,
    set: mockDocSet,
  });

  const collection = (_name: string) => {
    /* Don't reuse buildChain() — we need .where()/.get() to go to
       mockWhereGet, but collection.get() to go to mockColGet. */
    const c: Record<string, unknown> = {};
    c.where   = () => buildChain();
    c.limit   = () => buildChain();
    c.orderBy = () => buildChain();
    c.doc = (id?: string) => docRef(id);
    c.add = mockColAdd;
    c.get = () => mockColGet();
    return c;
  };

  return {
    adminAuth: () => ({
      verifySessionCookie: mockVerifySessionCookie,
      updateUser: mockUpdateAuthUser,
    }),
    adminDb: () => ({
      collection,
      batch: () => ({
        set:    (...args: unknown[]) => mockBatchSet(...args),
        commit: () => mockBatchCommit(),
      }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        get: () => mockDocGet(),
        set: (_r: unknown, p: unknown) => mockDocSet(p),
        update: (_r: unknown, p: unknown) => mockDocSet(p),
      }),
    }),
  };
});

/* Mock push-send so broadcast tests don't try to hit FCM. */
vi.mock('@/lib/push-send', () => ({
  sendPushToUser: vi.fn().mockResolvedValue({ sent: 1, pruned: 0 }),
}));

import { POST as CatUpsertPOST } from '@/app/api/admin/categories/upsert/route';
import { POST as CatDeletePOST } from '@/app/api/admin/categories/delete/route';
import { POST as DispOpenPOST }  from '@/app/api/disputes/open/route';
import { POST as DispResolvePOST } from '@/app/api/admin/disputes/resolve/route';
import { POST as SettingsPOST }  from '@/app/api/admin/settings/update/route';
import { POST as UnbanPOST }     from '@/app/api/admin/users/unban/route';
import { POST as BroadcastPOST } from '@/app/api/admin/broadcast/send/route';
import { POST as AdUpsertPOST }  from '@/app/api/admin/ads/upsert/route';
import { POST as AdDeletePOST }  from '@/app/api/admin/ads/delete/route';

function makeReq(url: string, body: unknown, opts?: { sessionCookie?: string | null }): NextRequest {
  const req = new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (opts?.sessionCookie !== null) {
    req.cookies.set('__session', opts?.sessionCookie ?? 'valid');
  }
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
  /* Safe defaults so unstubbed calls don't return undefined. */
  mockWhereGet.mockResolvedValue({ empty: true, docs: [], size: 0 });
  mockColGet.mockResolvedValue({ empty: true, docs: [], size: 0 });
  mockDocGet.mockResolvedValue({ exists: false, data: () => ({}) });
  mockVerifySessionCookie.mockResolvedValue({
    uid: 'admin-1', email: 'a@maawa.test', admin: true, role: 'super',
  });
});

/* ─── CATEGORIES ────────────────────────────────────────────────── */
describe('POST /api/admin/categories/upsert', () => {
  it('creates a new category with auto-slug', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const res = await CatUpsertPOST(makeReq('http://t/cat', { labelFr: 'Plomberie' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe('plomberie');
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.labelFr).toBe('Plomberie');
    expect(payload.active).toBe(true);
    expect(payload.createdAt).toBeTruthy();
  });

  it('strips French accents in the auto-slug', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const res = await CatUpsertPOST(makeReq('http://t/cat', { labelFr: 'Électricité' }));
    const json = await res.json();
    expect(json.id).toBe('electricite');
  });

  it('rejects non-admin with 403', async () => {
    mockVerifySessionCookie.mockResolvedValueOnce({ uid: 'u-1', email: 'u@m', admin: false });
    const res = await CatUpsertPOST(makeReq('http://t/cat', { labelFr: 'X' }));
    expect(res.status).toBe(403);
  });

  it('updates active flag on existing without resetting createdAt', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    await CatUpsertPOST(makeReq('http://t/cat', { id: 'plomberie', labelFr: 'Plomberie', active: false }));
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.active).toBe(false);
    expect(payload.createdAt).toBeUndefined();
  });
});

describe('POST /api/admin/categories/delete', () => {
  it('soft-deletes by flipping active=false', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    const res = await CatDeletePOST(makeReq('http://t/cat-del', { id: 'plomberie' }));
    expect(res.status).toBe(200);
    expect(mockDocSet.mock.calls[0]![0].active).toBe(false);
  });

  it('404 on missing category', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const res = await CatDeletePOST(makeReq('http://t/cat-del', { id: 'ghost' }));
    expect(res.status).toBe(404);
  });
});

/* ─── DISPUTES ──────────────────────────────────────────────────── */
describe('POST /api/disputes/open', () => {
  beforeEach(() => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'client-1', email: 'c@m', admin: false, role: null,
    });
  });

  it('opens a dispute for a participant', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ clientId: 'client-1', artisanId: 'artisan-1', status: 'terminee' }),
    });
    mockWhereGet.mockResolvedValueOnce({ empty: true });

    const res = await DispOpenPOST(makeReq('http://t/d', {
      missionId: 'mis-1', reason: 'no_show', note: 'Did not show up',
    }));
    expect(res.status).toBe(200);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.openedBy).toBe('client-1');
    expect(payload.againstUid).toBe('artisan-1');
    expect(payload.reason).toBe('no_show');
    expect(payload.status).toBe('open');
  });

  it('refuses dispute on pending mission with 409', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ clientId: 'client-1', artisanId: 'a', status: 'pending' }),
    });
    const res = await DispOpenPOST(makeReq('http://t/d', { missionId: 'm', reason: 'no_show' }));
    expect(res.status).toBe(409);
  });

  it('refuses non-participant with 403', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ clientId: 'other', artisanId: 'else', status: 'terminee' }),
    });
    const res = await DispOpenPOST(makeReq('http://t/d', { missionId: 'm', reason: 'no_show' }));
    expect(res.status).toBe(403);
  });

  it('refuses duplicate open dispute with 409', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ clientId: 'client-1', artisanId: 'a', status: 'terminee' }),
    });
    mockWhereGet.mockResolvedValueOnce({ empty: false });
    const res = await DispOpenPOST(makeReq('http://t/d', { missionId: 'm', reason: 'no_show' }));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/admin/disputes/resolve', () => {
  it('resolves with favor_opener and notifies both parties', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'open', openedBy: 'a', againstUid: 'b', missionId: 'm' }),
    });
    const res = await DispResolvePOST(makeReq('http://t/dr', {
      disputeId: 'd-1', outcome: 'favor_opener', resolution: 'En faveur du plaignant.',
    }));
    expect(res.status).toBe(200);
    const update = mockDocSet.mock.calls[0]![0];
    expect(update.status).toBe('resolved');
    expect(update.outcome).toBe('favor_opener');
    /* Two notifications (one per party) + one audit row = 3 col.add. */
    expect(mockColAdd).toHaveBeenCalledTimes(3);
  });

  it('dismiss outcome sets status=dismissed', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'open', openedBy: 'a', againstUid: 'b' }),
    });
    const res = await DispResolvePOST(makeReq('http://t/dr', {
      disputeId: 'd-1', outcome: 'dismiss', resolution: 'No basis',
    }));
    expect(res.status).toBe(200);
    expect(mockDocSet.mock.calls[0]![0].status).toBe('dismissed');
  });

  it('refuses already-resolved dispute with 409', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'resolved', openedBy: 'a', againstUid: 'b' }),
    });
    const res = await DispResolvePOST(makeReq('http://t/dr', {
      disputeId: 'd-1', outcome: 'dismiss', resolution: 'too late',
    }));
    expect(res.status).toBe(409);
  });
});

/* ─── SETTINGS ──────────────────────────────────────────────────── */
describe('POST /api/admin/settings/update', () => {
  it('writes only the fields provided with merge=true', async () => {
    const res = await SettingsPOST(makeReq('http://t/s', {
      mcRateDZD: 60, commissionPct: 8.5, supportPhone: '+213555000111',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.changed).toEqual(['mcRateDZD', 'commissionPct', 'supportPhone']);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.mcRateDZD).toBe(60);
    expect(payload.commissionPct).toBe(8.5);
    expect(payload.supportPhone).toBe('+213555000111');
    expect(payload.updatedBy).toBe('admin-1');
  });

  it('rejects out-of-range commission with 400', async () => {
    const res = await SettingsPOST(makeReq('http://t/s', { commissionPct: 99 }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed phone with 400', async () => {
    const res = await SettingsPOST(makeReq('http://t/s', { supportPhone: 'not-a-phone' }));
    expect(res.status).toBe(400);
  });

  it('returns empty changed-list with no fields', async () => {
    const res = await SettingsPOST(makeReq('http://t/s', {}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.changed).toEqual([]);
    expect(mockDocSet).not.toHaveBeenCalled();
  });
});

/* ─── UNBAN ─────────────────────────────────────────────────────── */
describe('POST /api/admin/users/unban', () => {
  it('flips banned=false and restores Auth account', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ banned: true, deleted: true, displayName: 'X' }),
    });
    mockUpdateAuthUser.mockResolvedValueOnce({});
    const res = await UnbanPOST(makeReq('http://t/ub', {
      uid: 'u-1', reason: 'False positive — appeal upheld',
    }));
    expect(res.status).toBe(200);
    const patch = mockDocSet.mock.calls[0]![0];
    expect(patch.banned).toBe(false);
    expect(patch.deleted).toBe(false);
    expect(mockUpdateAuthUser).toHaveBeenCalledWith('u-1', { disabled: false });
  });

  it('refuses when user is not banned with 409', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ banned: false, deleted: false }),
    });
    const res = await UnbanPOST(makeReq('http://t/ub', { uid: 'u-1', reason: 'why this happens' }));
    expect(res.status).toBe(409);
  });

  it('404 on missing user', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const res = await UnbanPOST(makeReq('http://t/ub', { uid: 'ghost', reason: 'a longer reason' }));
    expect(res.status).toBe(404);
  });
});

/* ─── BROADCAST ─────────────────────────────────────────────────── */
describe('POST /api/admin/broadcast/send', () => {
  it('writes broadcast doc + notif per user + audits', async () => {
    /* No transaction here — the route uses set() for broadcast doc,
       then collection.where().get() for users, then batch sets for
       notifs, then set() to update broadcast doc with totals. */
    mockWhereGet.mockResolvedValueOnce({
      docs: [
        { id: 'u-1' }, { id: 'u-2' }, { id: 'u-3' },
      ],
    });
    const res = await BroadcastPOST(makeReq('http://t/bc', {
      title: 'Test', body: 'Hello world', push: false,
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recipientCount).toBe(3);
    /* batch.set called once per recipient. */
    expect(mockBatchSet).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('rejects empty title with 400', async () => {
    const res = await BroadcastPOST(makeReq('http://t/bc', { title: '', body: 'x' }));
    expect(res.status).toBe(400);
  });

  it('rejects oversize body with 400', async () => {
    const res = await BroadcastPOST(makeReq('http://t/bc', { title: 't', body: 'x'.repeat(501) }));
    expect(res.status).toBe(400);
  });
});

/* ─── ADS ───────────────────────────────────────────────────────── */
describe('POST /api/admin/ads/upsert', () => {
  it('creates a new ad with active=true by default', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const res = await AdUpsertPOST(makeReq('http://t/ad', {
      title: 'Become an Artisan',
      body:  'Apply today and grow your business.',
      ctaUrl: '/apply', ctaLabel: 'Apply now',
    }));
    expect(res.status).toBe(200);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.title).toBe('Become an Artisan');
    expect(payload.active).toBe(true);
    expect(payload.ctaUrl).toBe('/apply');
    expect(payload.createdAt).toBeTruthy();
  });

  it('preserves createdAt on update', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    await AdUpsertPOST(makeReq('http://t/ad', {
      id: 'ad-1', title: 'Updated', body: 'New body',
    }));
    expect(mockDocSet.mock.calls[0]![0].createdAt).toBeUndefined();
  });

  it('rejects empty title with 400', async () => {
    const res = await AdUpsertPOST(makeReq('http://t/ad', { title: '', body: 'x' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/ads/delete', () => {
  it('soft-deletes by flipping active=false', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true });
    const res = await AdDeletePOST(makeReq('http://t/add', { id: 'ad-1' }));
    expect(res.status).toBe(200);
    expect(mockDocSet.mock.calls[0]![0].active).toBe(false);
  });

  it('404 on missing ad', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const res = await AdDeletePOST(makeReq('http://t/add', { id: 'ghost' }));
    expect(res.status).toBe(404);
  });
});
