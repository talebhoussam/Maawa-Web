/**
 * POST /api/reports/submit
 *
 * A signed-in user reports a piece of content or another user.
 * Reports queue up with status='open' for admin review.
 *
 * Body: {
 *   targetKind: 'user'|'post'|'reel'|'story'|'ad'|'comment',
 *   targetId:   string,
 *   reason:     'spam'|'harassment'|'fake'|'inappropriate'|'fraud'|'other',
 *   note?:      string (≤ 500 chars)
 * }
 *
 * Idempotency: we don't dedupe — the brief doesn't ask for it, and
 * multiple reports from different users on the same target are
 * useful signal. A single user re-reporting the same target writes
 * a new doc; admin can collapse during review.
 *
 * Audit: `report.submitted`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, audit } from '@/lib/api';

const Body = z.object({
  targetKind: z.enum(['user', 'post', 'reel', 'story', 'ad', 'comment']),
  targetId:   z.string().min(1).max(120),
  /* For comments (which live in feed_posts/{postId}/comments/{id})
     we need the post id so admins can delete with one call instead
     of a lookup. Required iff targetKind === 'comment'. */
  parentId:   z.string().min(1).max(120).optional(),
  reason:     z.enum(['spam', 'harassment', 'fake', 'inappropriate', 'fraud', 'other']),
  note:       z.string().max(500).optional(),
}).strict().refine(
  d => d.targetKind !== 'comment' || (typeof d.parentId === 'string' && d.parentId.length > 0),
  { message: 'parentId is required when targetKind is "comment"', path: ['parentId'] },
);

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const ref = adminDb().collection('reports').doc();
  await ref.set({
    reporterId: user.uid,
    targetKind: body.targetKind,
    targetId:   body.targetId,
    parentId:   body.parentId ?? null,
    reason:     body.reason,
    note:       body.note ?? null,
    status:     'open',
    createdAt:  Timestamp.now(),
  });

  await audit({
    actor:  user.uid,
    action: 'report.submitted',
    target: body.targetId,
    meta:   { kind: body.targetKind, reason: body.reason, reportId: ref.id, parentId: body.parentId ?? null },
  });

  return NextResponse.json({ ok: true, reportId: ref.id });
});
