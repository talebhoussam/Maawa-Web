/**
 * POST /api/unfollow
 *
 * Unfollow a user. Idempotent: deleting a non-existent doc returns
 * ok without error. We use a deterministic composite id so we don't
 * have to issue a query first.
 *
 * Body: { targetUserId: string }
 *
 * Audit: `social.unfollow` only when something was actually deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, audit } from '@/lib/api';

const Body = z.object({
  targetUserId: z.string().min(1).max(80),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const followRef = adminDb().collection('follows').doc(`${user.uid}_${body.targetUserId}`);
  const snap = await followRef.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: true, didDelete: false });
  }

  await followRef.delete();
  await audit({
    actor:  user.uid,
    action: 'social.unfollow',
    target: body.targetUserId,
  });

  return NextResponse.json({ ok: true, didDelete: true });
});
