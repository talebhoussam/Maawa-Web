/**
 * POST /api/admin/users/unverify
 *
 * Admin revokes an artisan's verified flag. Used from the
 * `/admin/verification` page when a previously-verified artisan
 * needs to be quarantined (fraud, expired credentials, etc.).
 *
 * Does NOT delete the user or revoke their auth session — the
 * artisan can still sign in, but the Maawa Support auto-suggest
 * stops including them and their badge disappears from the feed
 * and profile.
 *
 * Body: { uid: string, reason: string (min 5 chars) }
 *
 * Audit: `admin.user.unverify` with the reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound, conflict,
} from '@/lib/api';

const Body = z.object({
  uid:    z.string().min(1).max(80),
  reason: z.string().min(5).max(500),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const userRef = adminDb().collection('users').doc(body.uid);
  const snap = await userRef.get();
  if (!snap.exists) throw notFound(`User ${body.uid} not found`);
  const data = snap.data() as Record<string, unknown>;
  if (data.verified !== true) {
    throw conflict('User is not currently verified');
  }

  await userRef.set({
    verified:        false,
    unverifiedAt:    Timestamp.now(),
    unverifiedBy:    admin.uid,
    unverifyReason:  body.reason,
    updatedAt:       Timestamp.now(),
  }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.user.unverify',
    target: body.uid,
    meta:   { reason: body.reason },
  });

  return NextResponse.json({ ok: true });
});
