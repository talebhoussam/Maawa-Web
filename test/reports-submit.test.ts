import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Integration tests for POST /api/reports/submit.
 *
 * Covers:
 *   - 401 unauthenticated
 *   - 200 valid submit writes the doc with reporterId from the
 *     session (not the client) + status='open'
 *   - 400 invalid targetKind, invalid reason, oversize note
 *   - Optional `note` becomes null when omitted
 *   - Audit log row written with the expected action + meta
 */

const mockVerifySessionCookie = vi.fn();
const mockDocSet  = vi.fn();
const mockAuditAdd = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: () => ({ verifySessionCookie: mockVerifySessionCookie }),
  adminDb: () => ({
    collection: (name: string) => {
      if (name === 'audit_logs') return { add: mockAuditAdd };
      if (name === 'reports') {
        return {
          doc: (_id?: string) => ({
            id: `report_${Math.random().toString(36).slice(2, 10)}`,
            set: mockDocSet,
          }),
        };
      }
      return { doc: () => ({}), add: vi.fn() };
    },
  }),
}));

import { POST } from '@/app/api/reports/submit/route';

function makeReq(body: unknown, opts?: { sessionCookie?: string | null }): NextRequest {
  const req = new NextRequest('http://test/api/reports/submit', {
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
    uid: 'reporter-uid', email: 'r@maawa.test', admin: false, role: null,
  });
});

describe('POST /api/reports/submit', () => {
  it('rejects unauthenticated with 401', async () => {
    const res = await POST(makeReq(
      { targetKind: 'post', targetId: 'post-1', reason: 'spam' },
      { sessionCookie: null },
    ));
    expect(res.status).toBe(401);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('creates a valid report with status forced to open', async () => {
    const res = await POST(makeReq({
      targetKind: 'post',
      targetId:   'post-123',
      reason:     'harassment',
      note:       'Comportement agressif',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.reportId).toBeTruthy();

    /* Doc shape — reporterId comes from the verified session, NOT
       from any client-supplied value. The status is always 'open' at
       submit time (the rule enforces this too). */
    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.reporterId).toBe('reporter-uid');
    expect(payload.targetKind).toBe('post');
    expect(payload.targetId).toBe('post-123');
    expect(payload.reason).toBe('harassment');
    expect(payload.note).toBe('Comportement agressif');
    expect(payload.status).toBe('open');
    expect(payload.createdAt).toBeTruthy();
  });

  it('stores null when note is omitted', async () => {
    await POST(makeReq({
      targetKind: 'user', targetId: 'user-2', reason: 'fraud',
    }));
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.note).toBeNull();
  });

  it('writes a report.submitted audit row with the right meta', async () => {
    await POST(makeReq({
      targetKind: 'story', targetId: 'story-9', reason: 'inappropriate',
    }));
    expect(mockAuditAdd).toHaveBeenCalled();
    const audit = mockAuditAdd.mock.calls[0]![0];
    expect(audit.action).toBe('report.submitted');
    expect(audit.actor).toBe('reporter-uid');
    expect(audit.target).toBe('story-9');
    expect(audit.meta.kind).toBe('story');
    expect(audit.meta.reason).toBe('inappropriate');
    expect(audit.meta.reportId).toBeTruthy();
  });

  it('rejects unknown targetKind with 400', async () => {
    const res = await POST(makeReq({
      targetKind: 'video', /* not in the enum */
      targetId:   'x',
      reason:     'spam',
    }));
    expect(res.status).toBe(400);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects unknown reason with 400', async () => {
    const res = await POST(makeReq({
      targetKind: 'post', targetId: 'p', reason: 'because-i-said-so',
    }));
    expect(res.status).toBe(400);
  });

  it('rejects an oversize note (> 500 chars)', async () => {
    const res = await POST(makeReq({
      targetKind: 'post', targetId: 'p', reason: 'spam',
      note: 'x'.repeat(501),
    }));
    expect(res.status).toBe(400);
  });

  it('rejects missing targetId', async () => {
    const res = await POST(makeReq({
      targetKind: 'post', reason: 'spam',
    }));
    expect(res.status).toBe(400);
  });

  it('accepts all six valid reasons', async () => {
    for (const reason of ['spam', 'harassment', 'fake', 'inappropriate', 'fraud', 'other']) {
      mockDocSet.mockClear();
      const res = await POST(makeReq({
        targetKind: 'post', targetId: `p-${reason}`, reason,
      }));
      expect(res.status).toBe(200);
      expect(mockDocSet.mock.calls[0]![0].reason).toBe(reason);
    }
  });

  it('rejects comment report without parentId with 400', async () => {
    const res = await POST(makeReq({
      targetKind: 'comment', targetId: 'cmt-1', reason: 'spam',
    }));
    expect(res.status).toBe(400);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('persists parentId on a valid comment report', async () => {
    const res = await POST(makeReq({
      targetKind: 'comment', targetId: 'cmt-1', parentId: 'post-1', reason: 'harassment',
    }));
    expect(res.status).toBe(200);
    const payload = mockDocSet.mock.calls[0]![0];
    expect(payload.targetKind).toBe('comment');
    expect(payload.parentId).toBe('post-1');
  });

  it('stores parentId as null for non-comment reports', async () => {
    await POST(makeReq({
      targetKind: 'post', targetId: 'p-1', reason: 'spam',
    }));
    expect(mockDocSet.mock.calls[0]![0].parentId).toBeNull();
  });
});
