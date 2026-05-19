import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Integration tests for /api/follow and /api/unfollow.
 *
 * The route writes to /follows/{followerId}_{followingId} via the
 * Admin SDK. We mock firebase-admin and assert the right calls fire
 * for first-follow / re-follow / unfollow / self-follow.
 */

const mockVerifySessionCookie = vi.fn();
const mockFollowGet           = vi.fn();
const mockFollowSet           = vi.fn();
const mockFollowDelete        = vi.fn();
const mockNotifAdd            = vi.fn();
const mockAuditAdd            = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => {
      if (name === 'follows') {
        return {
          doc: (_id: string) => ({
            get:    mockFollowGet,
            set:    mockFollowSet,
            delete: mockFollowDelete,
          }),
        };
      }
      if (name === 'notifications') return { add: mockNotifAdd };
      if (name === 'audit_logs')    return { add: mockAuditAdd };
      return { doc: () => ({}), add: vi.fn() };
    },
  }),
}));

import { POST as FollowPOST }   from '@/app/api/follow/route';
import { POST as UnfollowPOST } from '@/app/api/unfollow/route';

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
    uid: 'follower-uid', email: 'me@maawa.test', admin: false, role: null,
  });
});

describe('POST /api/follow', () => {
  it('rejects unauthenticated with 401', async () => {
    const res = await FollowPOST(makeReq(
      'http://test/api/follow',
      { targetUserId: 'target-uid' },
      { sessionCookie: null },
    ));
    expect(res.status).toBe(401);
  });

  it('rejects self-follow with 400', async () => {
    const res = await FollowPOST(makeReq(
      'http://test/api/follow',
      { targetUserId: 'follower-uid' }, /* same as caller */
    ));
    expect(res.status).toBe(400);
    expect(mockFollowSet).not.toHaveBeenCalled();
  });

  it('creates follow doc + notif + audit on first follow', async () => {
    mockFollowGet.mockResolvedValue({ exists: false });
    const res = await FollowPOST(makeReq(
      'http://test/api/follow',
      { targetUserId: 'target-uid' },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyFollowing).toBe(false);

    /* Follow doc set with the documented shape. */
    expect(mockFollowSet).toHaveBeenCalledTimes(1);
    const payload = mockFollowSet.mock.calls[0]![0];
    expect(payload.followerId).toBe('follower-uid');
    expect(payload.followingId).toBe('target-uid');
    expect(payload.createdAt).toBeTruthy();

    /* Notification fired exactly once. */
    expect(mockNotifAdd).toHaveBeenCalledTimes(1);
    const notif = mockNotifAdd.mock.calls[0]![0];
    expect(notif.userId).toBe('target-uid');
    expect(notif.kind).toBe('new_follower');
    expect(notif.actorId).toBe('follower-uid');

    /* Audit row written. */
    expect(mockAuditAdd).toHaveBeenCalled();
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('social.follow');
  });

  it('is idempotent on re-follow — no second notif / set / audit', async () => {
    mockFollowGet.mockResolvedValue({ exists: true });
    const res = await FollowPOST(makeReq(
      'http://test/api/follow',
      { targetUserId: 'target-uid' },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alreadyFollowing).toBe(true);
    expect(mockFollowSet).not.toHaveBeenCalled();
    expect(mockNotifAdd).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});

describe('POST /api/unfollow', () => {
  it('rejects unauthenticated with 401', async () => {
    const res = await UnfollowPOST(makeReq(
      'http://test/api/unfollow',
      { targetUserId: 'target-uid' },
      { sessionCookie: null },
    ));
    expect(res.status).toBe(401);
  });

  it('deletes follow doc + audits when the doc existed', async () => {
    mockFollowGet.mockResolvedValue({ exists: true });
    const res = await UnfollowPOST(makeReq(
      'http://test/api/unfollow',
      { targetUserId: 'target-uid' },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.didDelete).toBe(true);
    expect(mockFollowDelete).toHaveBeenCalledTimes(1);
    expect(mockAuditAdd.mock.calls[0]![0].action).toBe('social.unfollow');
  });

  it('is idempotent on missing follow — no delete, no audit', async () => {
    mockFollowGet.mockResolvedValue({ exists: false });
    const res = await UnfollowPOST(makeReq(
      'http://test/api/unfollow',
      { targetUserId: 'target-uid' },
    ));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.didDelete).toBe(false);
    expect(mockFollowDelete).not.toHaveBeenCalled();
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});
