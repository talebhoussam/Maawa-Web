/**
 * POST /api/comments/create
 *
 * Add a comment to a feed_post (post or reel).
 *
 * Body: { postId: string, text: string (1..1000) }
 *
 * Why a route when the rule allows direct client writes? Three reasons:
 *   1. Hydrates `authorName` from /users/{uid} so the comment list
 *      doesn't need a join on every render.
 *   2. Bumps the parent's `commentsCount` (using FieldValue.increment)
 *      inside the same call so badge counts stay consistent.
 *   3. Notifies the post author on each NEW commenter (deduped per
 *      uid via a `commenters` array on the parent — keeps notif
 *      noise down for chatty threads).
 *
 * Audit: `comment.created` with meta={postId, length}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAuth, audit, notFound,
} from '@/lib/api';
import { sendPushToUser } from '@/lib/push-send';

const Body = z.object({
  postId: z.string().min(1).max(80),
  text:   z.string().min(1).max(1000),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const postRef = adminDb().collection('feed_posts').doc(body.postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) throw notFound(`Post ${body.postId} not found`);

  /* Hydrate caller's display name. */
  const userSnap = await adminDb().collection('users').doc(user.uid).get();
  const authorName = userSnap.exists
    ? String((userSnap.data() as Record<string, unknown>).displayName ?? 'Utilisateur')
    : 'Utilisateur';

  const now = Timestamp.now();
  const commentRef = postRef.collection('comments').doc();
  await commentRef.set({
    authorId:   user.uid,
    authorName,
    text:       body.text,
    createdAt:  now,
  });

  /* Parent updates. We don't need a transaction here: a couple of
     server-side concurrent writes on the same parent doc converge
     under Firestore's FieldValue.increment semantics, and the
     `commenters` arrayUnion is also idempotent. */
  const post = postSnap.data() as Record<string, unknown>;
  const wasNewCommenter = !Array.isArray(post.commenters) || !(post.commenters as string[]).includes(user.uid);

  await postRef.set({
    commentsCount: FieldValue.increment(1),
    commenters:    FieldValue.arrayUnion(user.uid),
    updatedAt:     now,
  }, { merge: true });

  /* Notify the post author once per new commenter (not per comment). */
  if (wasNewCommenter && typeof post.authorId === 'string' && post.authorId !== user.uid) {
    await adminDb().collection('notifications').add({
      userId:     post.authorId,
      kind:       'new_comment',
      actorId:    user.uid,
      postId:     body.postId,
      unread:     true,
      createdAt:  now,
    });
    /* Best-effort web push — failures don't block the response. */
    sendPushToUser(post.authorId, {
      title: 'Nouveau commentaire',
      body:  `${authorName} a commenté votre publication`,
      url:   `/feed`,
      tag:   `comment-${body.postId}`,
      data:  { kind: 'new_comment', postId: body.postId },
    }).catch(err => console.warn('push: comment notif failed', err));
  }

  await audit({
    actor:  user.uid,
    action: 'comment.created',
    target: body.postId,
    meta:   { commentId: commentRef.id, length: body.text.length },
  });

  return NextResponse.json({ ok: true, commentId: commentRef.id });
});
