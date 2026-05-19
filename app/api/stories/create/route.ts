/**
 * POST /api/stories/create
 *
 * Create a 24h-ephemeral story. Two kinds:
 *   - 'photo': mediaPath must point at /stories/{caller.uid}/{file}
 *              uploaded via the Firebase Storage client SDK BEFORE
 *              this call.
 *   - 'text':  text (1-200 chars) + gradient index (0..4).
 *
 * Body: { kind: 'photo' | 'text', mediaPath?: string, text?: string, gradient?: 0..4 }
 *
 * The expires-at timestamp is set to now+24h here so all clients see
 * the same horizon (don't compute on the browser). A future Cloud
 * Function will sweep expired docs; until then clients filter on read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, audit, badRequest } from '@/lib/api';

const Body = z.discriminatedUnion('kind', [
  z.object({
    kind:      z.literal('photo'),
    mediaPath: z.string().min(1).max(300),
  }).strict(),
  z.object({
    kind:     z.literal('text'),
    text:     z.string().min(1).max(200),
    gradient: z.number().int().min(0).max(4),
  }).strict(),
]);

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  /* For photo stories, verify the upload exists under the caller's
     folder. Same threat model as /api/wallet/purchase-request: a
     forged path can't reach a file the user doesn't own. */
  if (body.kind === 'photo') {
    const expectedPrefix = `stories/${user.uid}/`;
    if (!body.mediaPath.startsWith(expectedPrefix)) {
      throw badRequest(`mediaPath must start with ${expectedPrefix}`);
    }
    const file = adminStorage().bucket().file(body.mediaPath);
    const [exists] = await file.exists();
    if (!exists) throw badRequest('Story media not found in Storage');
  }

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + TWENTY_FOUR_HOURS_MS);

  const docRef = adminDb().collection('stories').doc();
  await docRef.set({
    userId:    user.uid,
    kind:      body.kind,
    /* Keep both fields present (null when N/A) so the schema is
       uniform — simpler than having sparse fields and reads safer. */
    mediaUrl:  body.kind === 'photo' ? body.mediaPath : null,
    text:      body.kind === 'text'  ? body.text      : null,
    gradient:  body.kind === 'text'  ? body.gradient  : null,
    createdAt: now,
    expiresAt,
    views:     0,
  });

  await audit({
    actor:  user.uid,
    action: 'story.created',
    target: docRef.id,
    meta:   { kind: body.kind },
  });

  return NextResponse.json({ ok: true, storyId: docRef.id });
});
