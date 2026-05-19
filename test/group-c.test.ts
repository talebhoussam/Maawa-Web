import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Group C integration tests:
 *   - /api/admin/users/unverify
 *   - /api/push/config
 *   - /api/push/register-token
 *   - lib/wilaya-coords (no I/O)
 *
 * sendPushToUser is intentionally not covered here — it requires a
 * functioning firebase-admin/messaging mock, and the helper is thin
 * enough that integration testing against a real Firebase project
 * (or the emulator) is more valuable than vitest mocks.
 */

const mockVerifySessionCookie = vi.fn();
const mockUserGet = vi.fn();
const mockUserSet = vi.fn();
const mockPushTokenSet = vi.fn();
const mockAuditAdd = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => {
      if (name === 'audit_logs') return { add: mockAuditAdd };
      if (name === 'users') {
        return {
          doc: (_uid: string) => ({
            get: mockUserGet,
            set: mockUserSet,
            collection: (sub: string) => {
              if (sub === 'push_tokens') {
                return {
                  doc: (_token: string) => ({ set: mockPushTokenSet }),
                };
              }
              return {};
            },
          }),
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
});

import { POST as UnverifyPOST }      from '@/app/api/admin/users/unverify/route';
import { POST as RegisterTokenPOST } from '@/app/api/push/register-token/route';
import { GET as PushConfigGET }      from '@/app/api/push/config/route';
import { wilayaCentroid, WILAYA_CENTROIDS } from '@/lib/wilaya-coords';

describe('POST /api/admin/users/unverify', () => {
  beforeEach(() => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'admin-1', email: 'a@maawa.test', admin: true, role: 'super',
    });
  });

  it('flips verified=false + audits with reason', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'artisan', verified: true }),
    });
    const res = await UnverifyPOST(makeReq(
      'http://test/api/admin/users/unverify',
      { uid: 'a-1', reason: 'NIN expiré — relance demandée' },
    ));
    expect(res.status).toBe(200);
    expect(mockUserSet).toHaveBeenCalled();
    const patch = mockUserSet.mock.calls[0]![0];
    expect(patch.verified).toBe(false);
    expect(patch.unverifiedBy).toBe('admin-1');
    expect(patch.unverifyReason).toBe('NIN expiré — relance demandée');

    expect(mockAuditAdd).toHaveBeenCalled();
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('admin.user.unverify');
  });

  it('rejects when user is not currently verified with 409', async () => {
    mockUserGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'artisan', verified: false }),
    });
    const res = await UnverifyPOST(makeReq(
      'http://test/api/admin/users/unverify',
      { uid: 'a-1', reason: 'placeholder reason' },
    ));
    expect(res.status).toBe(409);
    expect(mockUserSet).not.toHaveBeenCalled();
  });

  it('rejects when target user does not exist with 404', async () => {
    mockUserGet.mockResolvedValueOnce({ exists: false });
    const res = await UnverifyPOST(makeReq(
      'http://test/api/admin/users/unverify',
      { uid: 'ghost', reason: 'placeholder reason' },
    ));
    expect(res.status).toBe(404);
  });

  it('rejects empty reason with 400', async () => {
    const res = await UnverifyPOST(makeReq(
      'http://test/api/admin/users/unverify',
      { uid: 'a-1', reason: 'x' },  /* < 5 chars */
    ));
    expect(res.status).toBe(400);
  });

  it('rejects non-admin caller with 403', async () => {
    mockVerifySessionCookie.mockResolvedValueOnce({
      uid: 'u-1', email: 'u@maawa.test', admin: false, role: null,
    });
    const res = await UnverifyPOST(makeReq(
      'http://test/api/admin/users/unverify',
      { uid: 'a-1', reason: 'placeholder reason' },
    ));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/push/register-token', () => {
  beforeEach(() => {
    mockVerifySessionCookie.mockResolvedValue({
      uid: 'user-1', email: 'u@maawa.test', admin: false, role: null,
    });
  });

  it('upserts the token document', async () => {
    const res = await RegisterTokenPOST(makeReq(
      'http://test/api/push/register-token',
      { token: 'A'.repeat(50), userAgent: 'Mozilla/5.0' },
    ));
    expect(res.status).toBe(200);
    expect(mockPushTokenSet).toHaveBeenCalledTimes(1);
    const payload = mockPushTokenSet.mock.calls[0]![0];
    expect(payload.token.length).toBe(50);
    expect(payload.userAgent).toBe('Mozilla/5.0');
    expect(payload.lastSeenAt).toBeTruthy();
  });

  it('rejects short tokens with 400', async () => {
    const res = await RegisterTokenPOST(makeReq(
      'http://test/api/push/register-token',
      { token: 'short' },
    ));
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated with 401', async () => {
    const res = await RegisterTokenPOST(makeReq(
      'http://test/api/push/register-token',
      { token: 'A'.repeat(50) },
      { sessionCookie: null },
    ));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/push/config', () => {
  it('returns firebaseConfig + vapidKey (null when unset)', async () => {
    const res = await PushConfigGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.firebaseConfig).toBeDefined();
    expect(json.firebaseConfig.projectId).toBeTruthy();
    /* VAPID is optional — null in tests where the env var isn't set
       is the documented behavior. */
    expect(json).toHaveProperty('vapidKey');
  });
});

describe('lib/wilaya-coords', () => {
  it('has 58 wilaya centroids', () => {
    expect(Object.keys(WILAYA_CENTROIDS).length).toBe(58);
  });

  it('every centroid lat is in Algeria\'s rough bounds (18°N to 38°N)', () => {
    for (const [code, c] of Object.entries(WILAYA_CENTROIDS)) {
      expect(c.lat, `wilaya ${code} lat`).toBeGreaterThanOrEqual(18);
      expect(c.lat, `wilaya ${code} lat`).toBeLessThanOrEqual(38);
    }
  });

  it('every centroid lng is in Algeria\'s rough bounds (-9°W to 12°E)', () => {
    for (const [code, c] of Object.entries(WILAYA_CENTROIDS)) {
      expect(c.lng, `wilaya ${code} lng`).toBeGreaterThanOrEqual(-9);
      expect(c.lng, `wilaya ${code} lng`).toBeLessThanOrEqual(12);
    }
  });

  it('looks up a wilaya by the canonical "16 - Alger" label', () => {
    const c = wilayaCentroid('16 - Alger');
    expect(c).toBeTruthy();
    expect(c!.lat).toBeCloseTo(36.75, 1);
    expect(c!.lng).toBeCloseTo(3.04, 1);
  });

  it('looks up a wilaya by bare name', () => {
    const c = wilayaCentroid('Alger');
    expect(c).toBeTruthy();
    expect(c!.lat).toBeCloseTo(36.75, 1);
  });

  it('looks up a wilaya by bare code', () => {
    const c = wilayaCentroid('16');
    expect(c).toBeTruthy();
  });

  it('returns null for unknown / empty', () => {
    expect(wilayaCentroid(null)).toBeNull();
    expect(wilayaCentroid(undefined)).toBeNull();
    expect(wilayaCentroid('')).toBeNull();
    expect(wilayaCentroid('Wakanda')).toBeNull();
  });
});
