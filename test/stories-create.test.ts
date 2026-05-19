import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Integration tests for POST /api/stories/create.
 *
 * Same mock pattern as wallet-purchase-request: we stub
 * lib/firebase-admin so the route runs end-to-end without real
 * Firebase.
 *
 * Coverage:
 *   - 401 unauth
 *   - 200 for valid text story (text ≤ 200, gradient 0-4)
 *   - 200 for valid photo story (mediaPath under caller folder, file exists)
 *   - 400 for text > 200 chars
 *   - 400 for empty text
 *   - 400 for missing mediaPath on a photo story
 *   - 400 for mediaPath under a different user's folder
 *   - 400 for missing storage file
 *   - 400 for an unknown kind
 */

const mockVerifySessionCookie = vi.fn();
const mockDocSet      = vi.fn();
const mockAuditAdd    = vi.fn();
const mockFileExists  = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => ({
      doc: (id?: string) => ({
        id: id ?? `story_${Math.random().toString(36).slice(2, 10)}`,
        set: mockDocSet,
      }),
      add: name === 'audit_logs' ? mockAuditAdd : vi.fn(),
    }),
  }),
  adminStorage: () => ({
    bucket: () => ({
      file: (_path: string) => ({ exists: mockFileExists }),
    }),
  }),
}));

import { POST } from '@/app/api/stories/create/route';

function makeReq(body: unknown, opts?: { sessionCookie?: string | null }): NextRequest {
  const req = new NextRequest('http://test/api/stories/create', {
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
    uid: 'user-uid', email: 'u@maawa.test', admin: false, role: null,
  });
  mockFileExists.mockResolvedValue([true]);
});

describe('POST /api/stories/create', () => {
  it('rejects unauthenticated with 401', async () => {
    const req = makeReq({ kind: 'text', text: 'hi', gradient: 0 }, { sessionCookie: null });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('creates a valid text story', async () => {
    const res = await POST(makeReq({ kind: 'text', text: 'Hello world', gradient: 2 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.storyId).toBeTruthy();
    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.userId).toBe('user-uid');
    expect(payload.kind).toBe('text');
    expect(payload.text).toBe('Hello world');
    expect(payload.gradient).toBe(2);
    expect(payload.mediaUrl).toBeNull();
    expect(payload.views).toBe(0);
    expect(payload.createdAt).toBeTruthy();
    expect(payload.expiresAt).toBeTruthy();
    /* expiresAt should be ~24h after createdAt */
    const delta = payload.expiresAt.toMillis() - payload.createdAt.toMillis();
    expect(delta).toBe(24 * 60 * 60 * 1000);
  });

  it('creates a valid photo story', async () => {
    const res = await POST(makeReq({
      kind: 'photo', mediaPath: 'stories/user-uid/123-pic.jpg',
    }));
    expect(res.status).toBe(200);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.kind).toBe('photo');
    expect(payload.mediaUrl).toBe('stories/user-uid/123-pic.jpg');
    expect(payload.text).toBeNull();
    expect(payload.gradient).toBeNull();
  });

  it('rejects text > 200 chars with 400', async () => {
    const res = await POST(makeReq({
      kind: 'text', text: 'x'.repeat(201), gradient: 0,
    }));
    expect(res.status).toBe(400);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects empty text with 400', async () => {
    const res = await POST(makeReq({ kind: 'text', text: '', gradient: 0 }));
    expect(res.status).toBe(400);
  });

  it('rejects out-of-range gradient with 400', async () => {
    const res = await POST(makeReq({ kind: 'text', text: 'ok', gradient: 9 }));
    expect(res.status).toBe(400);
  });

  it('rejects photo story without mediaPath with 400', async () => {
    const res = await POST(makeReq({ kind: 'photo' }));
    expect(res.status).toBe(400);
  });

  it('rejects mediaPath under another user\'s folder', async () => {
    const res = await POST(makeReq({
      kind: 'photo', mediaPath: 'stories/other-uid/pic.jpg',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toMatch(/stories\/user-uid\//);
  });

  it('rejects when the storage file is missing', async () => {
    mockFileExists.mockResolvedValueOnce([false]);
    const res = await POST(makeReq({
      kind: 'photo', mediaPath: 'stories/user-uid/missing.jpg',
    }));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown kind with 400', async () => {
    const res = await POST(makeReq({ kind: 'video', text: 'x' }));
    expect(res.status).toBe(400);
  });

  it('rejects text story missing gradient with 400', async () => {
    const res = await POST(makeReq({ kind: 'text', text: 'hello' }));
    expect(res.status).toBe(400);
  });
});
