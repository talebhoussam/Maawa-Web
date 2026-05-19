/**
 * POST /api/admin/content/sponsor
 *
 * Admin-only. Flip the `sponsored` flag on a piece of user-generated
 * content. The flag is read-only on the browser via firestore.rules
 * (no client write path allows `sponsored`), so this server route is
 * the only way it ever changes.
 *
 * Body: {
 *   kind:      'feed_post' | 'reel' | 'story',
 *   id:        string,
 *   sponsored: boolean
 * }
 *
 * Audit: `admin.content.sponsor` with meta={kind,id,sponsored}.
 *
 * Note: reels live as `feed_posts where type='reel'` in this codebase,
 * so 'feed_post' and 'reel' both route to /feed_posts/{id}. We accept
 * both for future-proofing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, notFound } from '@/lib/api';

const Body = z.object({
  kind:      z.enum(['feed_post', 'reel', 'story']),
  id:        z.string().min(1).max(80),
  sponsored: z.boolean(),
}).strict();

const COLLECTIONS: Record<'feed_post' | 'reel' | 'story', string> = {
  feed_post: 'feed_posts',
  reel:      'feed_posts',
  story:     'stories',
};

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const ref  = adminDb().collection(COLLECTIONS[body.kind]).doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound(`${body.kind} ${body.id} not found`);

  await ref.set({ sponsored: body.sponsored }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.content.sponsor',
    target: body.id,
    meta:   { kind: body.kind, sponsored: body.sponsored },
  });

  return NextResponse.json({ ok: true });
});
