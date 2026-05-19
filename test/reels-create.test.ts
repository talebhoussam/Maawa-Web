import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Integration tests for POST /api/reels/create.
 *
 * Coverage:
 *   - 401 unauthenticated
 *   - 400 when videoPath isn't under the caller's reels/ folder
 *   - 400 when the storage video doesn't exist
 *   - 400 when the storage poster doesn't exist (when one was passed)
 *   - 200 happy path writes a feed_posts doc with type='reel',
 *     authorId from session, likes:0, sponsored:false (admin-only)
 *   - Hydrates artisan name/trade/wilaya/verified from /users/{uid}
 *   - audit row 'reel.created' fires
 */

const mockVerifySessionCookie = vi.fn();
const mockUserGet     = vi.fn();
const mockDocSet      = vi.fn();
const mockAuditAdd    = vi.fn();
const mockVideoExists = vi.fn();
const mockPosterExists = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => {
      if (name === 'audit_logs') return { add: mockAuditAdd };
      if (name === 'users') return { doc: (_id: string) => ({ get: mockUserGet }) };
      if (name === 'feed_posts') {
        return {
          doc: (_id?: string) => ({
            id: `reel_${Math.random().toString(36).slice(2, 10)}`,
            set: mockDocSet,
          }),
        };
      }
      return { doc: () => ({}), add: vi.fn() };
    },
  }),
  adminStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        exists: path.includes('poster') ? mockPosterExists : mockVideoExists,
      }),
    }),
  }),
}));

import { POST } from '@/app/api/reels/create/route';

function makeReq(body: unknown, opts?: { sessionCookie?: string | null }): NextRequest {
  const req = new NextRequest('http://test/api/reels/create', {
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
  mockVideoExists.mockResolvedValue([true]);
  mockPosterExists.mockResolvedValue([true]);
  mockUserGet.mockResolvedValue({
    exists: true,
    data: () => ({
      displayName: 'Karim Plombier',
      trade:       'Plomberie',
      wilaya:      '16 - Alger',
      verified:    true,
    }),
  });
});

describe('POST /api/reels/create', () => {
  it('rejects unauthenticated with 401', async () => {
    const res = await POST(makeReq(
      { videoPath: 'reels/artisan-uid/1.mp4' },
      { sessionCookie: null },
    ));
    expect(res.status).toBe(401);
  });

  it('rejects videoPath outside caller\'s reels folder', async () => {
    const res = await POST(makeReq({
      videoPath: 'reels/other-uid/1.mp4',
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toMatch(/reels\/artisan-uid\//);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects posterPath outside caller\'s reels folder', async () => {
    const res = await POST(makeReq({
      videoPath:  'reels/artisan-uid/1.mp4',
      posterPath: 'reels/other-uid/poster.jpg',
    }));
    expect(res.status).toBe(400);
  });

  it('rejects when the storage video is missing', async () => {
    mockVideoExists.mockResolvedValueOnce([false]);
    const res = await POST(makeReq({
      videoPath: 'reels/artisan-uid/missing.mp4',
    }));
    expect(res.status).toBe(400);
  });

  it('rejects when poster path provided but file missing', async () => {
    mockPosterExists.mockResolvedValueOnce([false]);
    const res = await POST(makeReq({
      videoPath:  'reels/artisan-uid/1.mp4',
      posterPath: 'reels/artisan-uid/poster.jpg',
    }));
    expect(res.status).toBe(400);
  });

  it('happy path writes feed_posts with type=reel, sponsored=false, hydrated author', async () => {
    const res = await POST(makeReq({
      videoPath:   'reels/artisan-uid/123-clip.mp4',
      posterPath:  'reels/artisan-uid/123-poster.jpg',
      title:       'Installation chaudière',
      description: 'À Hydra ce matin.',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.reelId).toBeTruthy();

    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.authorId).toBe('artisan-uid');
    expect(payload.type).toBe('reel');
    expect(payload.likes).toBe(0);
    expect(payload.sponsored).toBe(false);
    expect(payload.videoUrl).toBe('reels/artisan-uid/123-clip.mp4');
    expect(payload.posterUrl).toBe('reels/artisan-uid/123-poster.jpg');
    expect(payload.title).toBe('Installation chaudière');
    expect(payload.description).toBe('À Hydra ce matin.');
    expect(payload.text).toBe('À Hydra ce matin.'); /* satisfies rule */
    /* Hydrated from /users */
    expect(payload.artisan).toBe('Karim Plombier');
    expect(payload.trade).toBe('Plomberie');
    expect(payload.wilaya).toBe('16 - Alger');
    expect(payload.verified).toBe(true);
  });

  it('works without poster — posterUrl is null', async () => {
    const res = await POST(makeReq({
      videoPath: 'reels/artisan-uid/clip.mp4',
    }));
    expect(res.status).toBe(200);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.posterUrl).toBeNull();
  });

  it('falls back gracefully when user doc is missing', async () => {
    mockUserGet.mockResolvedValueOnce({ exists: false });
    const res = await POST(makeReq({
      videoPath: 'reels/artisan-uid/clip.mp4',
    }));
    expect(res.status).toBe(200);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.artisan).toBe('Artisan');
    expect(payload.verified).toBe(false);
  });

  it('emits reel.created audit row', async () => {
    await POST(makeReq({ videoPath: 'reels/artisan-uid/clip.mp4' }));
    expect(mockAuditAdd).toHaveBeenCalled();
    const audit = mockAuditAdd.mock.calls[0]![0];
    expect(audit.action).toBe('reel.created');
    expect(audit.actor).toBe('artisan-uid');
    expect(audit.meta.hasPoster).toBe(false);
  });

  it('rejects 400 on missing videoPath', async () => {
    const res = await POST(makeReq({ title: 'no video' }));
    expect(res.status).toBe(400);
  });
});
