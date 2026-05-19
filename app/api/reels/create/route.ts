/**
 * POST /api/reels/create
 *
 * Publish a reel. The browser uploads the video (and optional poster
 * image) to /reels/{caller.uid}/* BEFORE calling this route. We:
 *   1. Verify the uploaded files exist under the caller's folder.
 *   2. Hydrate the artisan's display info from /users/{uid} so the
 *      feed card can render without a join.
 *   3. Write a feed_posts doc with type='reel', videoUrl, posterUrl,
 *      authorId, likes:0, sponsored:false.
 *
 * Body: {
 *   videoPath:  string,                    // required, under reels/{uid}/
 *   posterPath: string | null | undefined, // optional, same folder
 *   title?:     string (≤ 120 chars),
 *   description?: string (≤ 2000 chars)
 * }
 *
 * Audit: `reel.created`.
 *
 * Open question on threat model: feed_posts.create allows direct
 * client writes too (rule above). This route adds value not by being
 * the only path but by being the SAFE path — it strips `sponsored`,
 * proves Storage paths exist, and audits. Browser callers should use
 * this; rules still defend against ad-hoc admin-SDK-less writers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, audit, badRequest } from '@/lib/api';

const Body = z.object({
  videoPath:   z.string().min(1).max(300),
  posterPath:  z.string().min(1).max(300).optional().nullable(),
  title:       z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  /* Defense: the video path must be under this user's reels folder.
     A forged path that points at someone else's file would otherwise
     let an attacker claim authorship. */
  const expectedPrefix = `reels/${user.uid}/`;
  if (!body.videoPath.startsWith(expectedPrefix)) {
    throw badRequest(`videoPath must start with ${expectedPrefix}`);
  }
  if (body.posterPath && !body.posterPath.startsWith(expectedPrefix)) {
    throw badRequest(`posterPath must start with ${expectedPrefix}`);
  }

  /* Verify the uploads landed in Storage. Bare-path file refs work
     against the default bucket. */
  const videoFile = adminStorage().bucket().file(body.videoPath);
  const [videoExists] = await videoFile.exists();
  if (!videoExists) throw badRequest('Reel video not found in Storage');

  if (body.posterPath) {
    const posterFile = adminStorage().bucket().file(body.posterPath);
    const [posterExists] = await posterFile.exists();
    if (!posterExists) throw badRequest('Reel poster not found in Storage');
  }

  /* Hydrate author info so the feed card can render the artisan's
     name + trade + wilaya + verified flag without a second read.
     Falls back to defaults if the user doc is unexpectedly missing. */
  const userSnap = await adminDb().collection('users').doc(user.uid).get();
  const userData = userSnap.exists ? userSnap.data() as Record<string, unknown> : {};

  const now = Timestamp.now();
  const docRef = adminDb().collection('feed_posts').doc();
  await docRef.set({
    authorId:    user.uid,
    artisan:     typeof userData.displayName === 'string' ? userData.displayName : 'Artisan',
    trade:       typeof userData.trade        === 'string' ? userData.trade        : null,
    wilaya:      typeof userData.wilaya       === 'string' ? userData.wilaya       : null,
    verified:    userData.verified === true,
    type:        'reel',
    title:       body.title       ?? null,
    description: body.description ?? null,
    text:        body.description ?? body.title ?? '', /* satisfy feed_posts.create rule (`text is string`) */
    videoUrl:    body.videoPath,           /* bare path — client resolves via getDownloadURL */
    posterUrl:   body.posterPath ?? null,
    likes:       0,
    sponsored:   false,                    /* admin-set only via /api/admin/content/sponsor */
    createdAt:   now,
  });

  await audit({
    actor:  user.uid,
    action: 'reel.created',
    target: docRef.id,
    meta:   { hasPoster: Boolean(body.posterPath) },
  });

  return NextResponse.json({ ok: true, reelId: docRef.id });
});
