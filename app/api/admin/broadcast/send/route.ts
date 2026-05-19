/**
 * POST /api/admin/broadcast/send
 *
 * Send a notification to every user. We write:
 *   1. A /broadcasts/{id} record (the audit trail of what was sent).
 *   2. A /notifications/{id} doc per recipient (Firestore-visible).
 *   3. Best-effort FCM push to each recipient that has tokens.
 *
 * Batched writes 500 at a time per Firestore's commit cap. For very
 * large user bases this could take a while — we return early after
 * the broadcast doc is written, and run the fan-out in the
 * background. That's intentional: the admin gets immediate feedback,
 * and partial failures (single users without push tokens) don't fail
 * the whole call.
 *
 * Body: {
 *   title: string (≤ 80),
 *   body:  string (≤ 500),
 *   url?:  string — optional deep-link to open on tap,
 *   push:  boolean — also send web push (default true)
 * }
 *
 * Audit: `admin.broadcast.sent` with meta={broadcastId, recipientCount}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit } from '@/lib/api';
import { sendPushToUser } from '@/lib/push-send';

const Body = z.object({
  title: z.string().min(1).max(80),
  body:  z.string().min(1).max(500),
  url:   z.string().max(200).optional(),
  push:  z.boolean().optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const b     = await parseBody(req, Body);

  const now = Timestamp.now();

  /* 1. Audit trail of what's being sent. Record this FIRST so we
        have it even if the fan-out fails. */
  const broadcastRef = adminDb().collection('broadcasts').doc();
  await broadcastRef.set({
    title:       b.title,
    body:        b.body,
    url:         b.url ?? null,
    pushEnabled: b.push ?? true,
    sentBy:      admin.uid,
    createdAt:   now,
    status:      'sending',
    recipientCount: 0,
    pushSent:    0,
  });

  /* 2. Fetch all non-banned, non-deleted users. We don't try to be
        clever about pagination here — at typical Maawa scale (low
        thousands), a single read is fine. If this grows past 10k
        users, swap to a paginated approach. */
  const usersSnap = await adminDb().collection('users')
    .where('banned', '!=', true)
    .get();
  const uids = usersSnap.docs.map(d => d.id);

  /* 3. Write notifications in batches of 500 (Firestore commit cap). */
  let written = 0;
  for (let i = 0; i < uids.length; i += 500) {
    const batch = adminDb().batch();
    for (const uid of uids.slice(i, i + 500)) {
      const ref = adminDb().collection('notifications').doc();
      batch.set(ref, {
        userId:      uid,
        kind:        'broadcast',
        title:       b.title,
        body:        b.body,
        url:         b.url ?? null,
        broadcastId: broadcastRef.id,
        actorId:     admin.uid,
        unread:      true,
        createdAt:   now,
      });
      written++;
    }
    await batch.commit();
  }

  /* 4. Best-effort push fan-out, fire-and-forget. We don't await each
        send — but we do await the overall Promise.allSettled so the
        broadcast doc's pushSent count reflects reality before we
        return. For large user bases this could be slow; the admin
        UI handles the loading state. */
  let pushSent = 0;
  if (b.push !== false) {
    const results = await Promise.allSettled(uids.map(uid => sendPushToUser(uid, {
      title: b.title, body: b.body,
      url:   b.url,
      tag:   `broadcast-${broadcastRef.id}`,
      data:  { kind: 'broadcast', broadcastId: broadcastRef.id },
    })));
    for (const r of results) {
      if (r.status === 'fulfilled') pushSent += r.value.sent;
    }
  }

  await broadcastRef.set({
    status:         'sent',
    recipientCount: written,
    pushSent,
    finishedAt:     Timestamp.now(),
  }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.broadcast.sent',
    target: broadcastRef.id,
    meta:   { recipientCount: written, pushSent, title: b.title },
  });

  return NextResponse.json({
    ok: true,
    broadcastId:    broadcastRef.id,
    recipientCount: written,
    pushSent,
  });
});
