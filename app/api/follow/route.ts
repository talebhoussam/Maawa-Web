/**
 * POST /api/follow
 *
 * Follow another user. Idempotent: re-following the same target is a
 * no-op (we use a composite-id `set` rather than `add` so duplicates
 * are impossible). Refuses self-follow.
 *
 * Body: { targetUserId: string }
 *
 * Side effects:
 *   - Writes /follows/{followerId}_{followingId}.
 *   - Writes a notifications doc to the target with kind='new_follower'
 *     ONLY on the first follow (so re-follow doesn't spam notifs).
 *
 * Audit: `social.follow`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, audit, badRequest } from '@/lib/api';
import { sendPushToUser } from '@/lib/push-send';

const Body = z.object({
  targetUserId: z.string().min(1).max(80),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  if (body.targetUserId === user.uid) {
    throw badRequest('Cannot follow yourself');
  }

  const followId  = `${user.uid}_${body.targetUserId}`;
  const followRef = adminDb().collection('follows').doc(followId);

  /* Detect first-time vs re-follow so the notif fires once. */
  const existing = await followRef.get();
  const wasAlreadyFollowing = existing.exists;

  const now = Timestamp.now();
  if (!wasAlreadyFollowing) {
    await followRef.set({
      followerId:  user.uid,
      followingId: body.targetUserId,
      createdAt:   now,
    });

    await adminDb().collection('notifications').add({
      userId:    body.targetUserId,
      kind:      'new_follower',
      actorId:   user.uid,
      unread:    true,
      createdAt: now,
    });

    /* Best-effort push. Wrap the whole block — including the actor-
       name hydration — in try/catch so a Firestore hiccup on the
       users doc can't break the follow itself. */
    try {
      const actorSnap = await adminDb().collection('users').doc(user.uid).get();
      const actorName = actorSnap.exists
        ? String((actorSnap.data() as Record<string, unknown>).displayName ?? 'Quelqu\'un')
        : 'Quelqu\'un';
      sendPushToUser(body.targetUserId, {
        title: 'Nouvel abonné',
        body:  `${actorName} vous suit maintenant`,
        url:   `/profile/${user.uid}`,
        tag:   `follow-${user.uid}`,
        data:  { kind: 'new_follower', followerId: user.uid },
      }).catch(err => console.warn('push: follow notif failed', err));
    } catch (err) {
      console.warn('push: follow hydration failed', err);
    }

    await audit({
      actor:  user.uid,
      action: 'social.follow',
      target: body.targetUserId,
    });
  }

  return NextResponse.json({ ok: true, alreadyFollowing: wasAlreadyFollowing });
});
