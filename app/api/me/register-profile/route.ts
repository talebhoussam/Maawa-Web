/**
 * POST /api/me/register-profile
 *
 * Called once at the end of registration. Creates the user's Firestore
 * profile doc with the SERVER as the writer, so we control exactly which
 * fields land. Always sets role='client' regardless of what the client
 * sends — becoming an artisan goes through /api/applications/submit
 * and admin review.
 *
 * Idempotent: if the profile already exists, this returns ok without
 * overwriting (prevents data loss if the user double-clicks).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth } from '@/lib/api';

const Body = z.object({
  firstName: z.string().min(1).max(40),
  lastName:  z.string().min(1).max(40),
  phone:     z.string().regex(/^\+213[567]\d{8}$/).optional(),
  wilaya:    z.string().min(1).max(80),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const ref = adminDb().collection('users').doc(user.uid);
  const existing = await ref.get();
  if (existing.exists && existing.data()?.firstName) {
    /* Idempotent — return ok but don't overwrite. */
    return NextResponse.json({ ok: true, alreadyRegistered: true });
  }

  /* Sync displayName onto the Firebase Auth user too — that's what
     Firebase shows in the auth console, password-reset emails, etc. */
  const displayName = `${body.firstName} ${body.lastName}`.trim();
  await adminAuth().updateUser(user.uid, { displayName });

  const now = Timestamp.now();
  await ref.set({
    uid:          user.uid,
    email:        user.email,
    firstName:    body.firstName,
    lastName:     body.lastName,
    displayName,
    phone:        body.phone ?? null,
    wilaya:       body.wilaya,
    role:         'client',           /* always — artisan via separate flow */
    verified:     false,
    banned:       false,
    createdAt:    now,
    updatedAt:    now,
  }, { merge: true });

  /* Create the Maawa Support thread for this user. Idempotent via the
     deterministic chatId `maawa-support_{uid}` — re-running this
     route won't create duplicates. The peer id '_maawa_support' is a
     constant; admins read these threads via /admin/support. */
  const supportChatId  = `maawa-support_${user.uid}`;
  const supportChatRef = adminDb().collection('chats').doc(supportChatId);
  const supportExisting = await supportChatRef.get();
  if (!supportExisting.exists) {
    await supportChatRef.set({
      participants:   [user.uid, '_maawa_support'],
      isSupport:      true,
      lastMessage:    null,
      lastMessageAt:  now,
      /* Per-participant unread counters as a map so a single doc
         covers both directions. */
      unread:         { [user.uid]: 0, _maawa_support: 0 },
      createdAt:      now,
      updatedAt:      now,
    });
  }

  return NextResponse.json({ ok: true });
});
