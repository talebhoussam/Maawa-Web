import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Group A integration tests:
 *   - /api/artisan/mission/start
 *   - /api/artisan/mission/complete
 *   - /api/me/available
 *   - /api/me/artisan-profile
 *
 * One mock harness covers all four routes since they all use the same
 * adminAuth + adminDb surface.
 */

const mockVerifySessionCookie = vi.fn();
const mockMissionGet = vi.fn();
const mockMissionUpdate = vi.fn();
const mockUserGet = vi.fn();
const mockUserSet = vi.fn();
const mockNotifSet = vi.fn();
const mockAuditAdd = vi.fn();

/* runTransaction passes a tx object whose `get/update/set` we route
   to the mocks above. The order of `tx.get` calls matters per route. */
const mockRunTransaction = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    runTransaction: mockRunTransaction,
    collection: (name: string) => {
      if (name === 'audit_logs')    return { add: mockAuditAdd };
      if (name === 'users') {
        return {
          doc: (_id: string) => ({
            get: mockUserGet,
            set: mockUserSet,
          }),
        };
      }
      if (name === 'missions') {
        return {
          doc: (_id: string) => ({
            get: mockMissionGet,
            update: mockMissionUpdate,
          }),
        };
      }
      if (name === 'notifications') {
        return { doc: (_id?: string) => ({ id: 'n_x', set: mockNotifSet }) };
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
    uid: 'artisan-uid', email: 'a@maawa.test', admin: false, role: null,
  });
  /* Default user doc — verified artisan with everything wired. */
  mockUserGet.mockResolvedValue({
    exists: true,
    data: () => ({
      role: 'artisan',
      verified: true,
      displayName: 'Karim Plombier',
    }),
  });
  /* Default mission — assigned to me, confirmed. The runTransaction
     mock invokes our tests' callback synchronously and we shape tx
     ourselves. */
  mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      get: (ref: unknown) => {
        /* Distinguish mission vs user by which mock was last set up.
           Both routes call tx.get on the user-or-mission ref; we
           inspect what mocked function backs it by trying mission
           first, then user. The route uses adminDb().collection(...).doc(...)
           which our mock returns with both `get` methods bound. */
        void ref;
        return mockMissionGet();
      },
      update: (_ref: unknown, payload: unknown) => mockMissionUpdate(payload),
      set:    (_ref: unknown, payload: unknown) => mockNotifSet(payload),
    };
    return fn(tx);
  });
});

import { POST as StartPOST }          from '@/app/api/artisan/mission/start/route';
import { POST as CompletePOST }       from '@/app/api/artisan/mission/complete/route';
import { POST as AvailablePOST }      from '@/app/api/me/available/route';
import { POST as ArtisanProfilePOST } from '@/app/api/me/artisan-profile/route';

describe('POST /api/artisan/mission/start', () => {
  it('flips confirmed → in_progress with a startedAt timestamp', async () => {
    mockMissionGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        artisanId: 'artisan-uid',
        status:    'confirmed',
        clientId:  'client-uid',
      }),
    });
    const res = await StartPOST(makeReq(
      'http://test/api/artisan/mission/start',
      { missionId: 'mis-1' },
    ));
    expect(res.status).toBe(200);
    const update = mockMissionUpdate.mock.calls[0]![0];
    expect(update.status).toBe('in_progress');
    expect(update.startedAt).toBeTruthy();
    /* Notification to the client was queued. */
    const notif = mockNotifSet.mock.calls.find(c => c[0]?.kind === 'mission_started')?.[0];
    expect(notif).toBeTruthy();
    expect(notif.userId).toBe('client-uid');
  });

  it('rejects when caller is not the assigned artisan with 403', async () => {
    mockMissionGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ artisanId: 'someone-else', status: 'confirmed' }),
    });
    const res = await StartPOST(makeReq(
      'http://test/api/artisan/mission/start',
      { missionId: 'mis-1' },
    ));
    expect(res.status).toBe(403);
  });

  it('rejects when status is not confirmed with 409', async () => {
    mockMissionGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ artisanId: 'artisan-uid', status: 'pending' }),
    });
    const res = await StartPOST(makeReq(
      'http://test/api/artisan/mission/start',
      { missionId: 'mis-1' },
    ));
    expect(res.status).toBe(409);
  });

  it('rejects when the mission does not exist with 404', async () => {
    mockMissionGet.mockResolvedValueOnce({ exists: false });
    const res = await StartPOST(makeReq(
      'http://test/api/artisan/mission/start',
      { missionId: 'mis-x' },
    ));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/artisan/mission/complete', () => {
  it('flips in_progress → terminee with completedAt + audit', async () => {
    mockMissionGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        artisanId: 'artisan-uid',
        status:    'in_progress',
        clientId:  'client-uid',
      }),
    });
    const res = await CompletePOST(makeReq(
      'http://test/api/artisan/mission/complete',
      { missionId: 'mis-1' },
    ));
    expect(res.status).toBe(200);
    const update = mockMissionUpdate.mock.calls[0]![0];
    expect(update.status).toBe('terminee');
    expect(update.completedAt).toBeTruthy();
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('mission.completed');
  });

  it('rejects when status is not in_progress', async () => {
    mockMissionGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ artisanId: 'artisan-uid', status: 'confirmed' }),
    });
    const res = await CompletePOST(makeReq(
      'http://test/api/artisan/mission/complete',
      { missionId: 'mis-1' },
    ));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/me/available', () => {
  it('flips users/{uid}.available with audit row', async () => {
    const res = await AvailablePOST(makeReq(
      'http://test/api/me/available',
      { available: false },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(mockUserSet).toHaveBeenCalled();
    expect(mockUserSet.mock.calls[0]![0].available).toBe(false);
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('artisan.available');
  });

  it('refuses non-artisan with 403', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'client' }),
    });
    const res = await AvailablePOST(makeReq(
      'http://test/api/me/available',
      { available: false },
    ));
    expect(res.status).toBe(403);
    expect(mockUserSet).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated with 401', async () => {
    const res = await AvailablePOST(makeReq(
      'http://test/api/me/available',
      { available: true },
      { sessionCookie: null },
    ));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/me/artisan-profile', () => {
  it('updates the patched fields and audits with the field list', async () => {
    const res = await ArtisanProfilePOST(makeReq(
      'http://test/api/me/artisan-profile',
      {
        trade: 'Plomberie',
        experience: 8,
        hourlyRate: 1500,
        serviceAreas: ['16 - Alger', '09 - Blida', '16 - Alger'],
        bio: 'Spécialiste chaudières.',
      },
    ));
    expect(res.status).toBe(200);
    const patch = mockUserSet.mock.calls[0]![0];
    expect(patch.trade).toBe('Plomberie');
    expect(patch.experience).toBe(8);
    expect(patch.hourlyRate).toBe(1500);
    /* Service areas deduped + sorted. */
    expect(patch.serviceAreas).toEqual(['09 - Blida', '16 - Alger']);
    expect(patch.bio).toBe('Spécialiste chaudières.');
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('artisan.profile.update');
    expect(mockAuditAdd.mock.calls[0]![0].meta.fields).toContain('trade');
  });

  it('refuses empty patch with 400', async () => {
    const res = await ArtisanProfilePOST(makeReq(
      'http://test/api/me/artisan-profile',
      {},
    ));
    expect(res.status).toBe(400);
  });

  it('refuses non-artisan with 403', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'client' }),
    });
    const res = await ArtisanProfilePOST(makeReq(
      'http://test/api/me/artisan-profile',
      { trade: 'Plomberie' },
    ));
    expect(res.status).toBe(403);
  });

  it('refuses out-of-range hourlyRate with 400', async () => {
    const res = await ArtisanProfilePOST(makeReq(
      'http://test/api/me/artisan-profile',
      { hourlyRate: 9999999 },
    ));
    expect(res.status).toBe(400);
  });

  it('refuses oversized serviceAreas list with 400', async () => {
    const res = await ArtisanProfilePOST(makeReq(
      'http://test/api/me/artisan-profile',
      { serviceAreas: Array.from({ length: 59 }, (_, i) => `${i}`) },
    ));
    expect(res.status).toBe(400);
  });
});
