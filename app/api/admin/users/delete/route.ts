/**
 * POST /api/admin/users/delete
 *
 * Soft-deletes a user. Hard delete is a manual operation in the
 * Firestore console — too dangerous for an API surface.
 *
 * What we do:
 *   1. Anonymise the user doc: displayName→"Compte supprimé",
 *      strip email/phone/avatarUrl, set deleted/deletedAt/deletedBy/
 *      deletedReason flags.
 *   2. Disable the Firebase Auth account so they can't sign back in.
 *   3. Revoke all refresh tokens so any active sessions die at the
 *      next ID-token refresh (max ~1 hour).
 *
 * What we DON'T touch:
 *   - Their posts, reels, stories, messages — those live in their
 *     own collections and have their own admin moderation paths.
 *   - Their transactions — financial audit trail must survive.
 *
 * Body: { uid: string, reason: string (min 5 chars) }
 * Audit: `admin.user.soft_delete` with meta={reason}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound,
} from '@/lib/api';

const Body = z.object({
  uid:    z.string().min(1).max(80),
  reason: z.string().min(5).max(500),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req, ['super', 'manager']);
  const body  = await parseBody(req, Body);

  const userRef = adminDb().collection('users').doc(body.uid);
  const snap = await userRef.get();
  if (!snap.exists) throw notFound(`User ${body.uid} not found`);

  const now = Timestamp.now();
  await userRef.set({
    deleted:        true,
    deletedAt:      now,
    deletedBy:      admin.uid,
    deletedReason:  body.reason,
    /* Anonymise — keep the doc so foreign-key references don't
       dangle, but strip everything that identifies the person. */
    displayName:    'Compte supprimé',
    firstName:      null,
    lastName:       null,
    email:          null,
    phone:          null,
    avatarUrl:      null,
    bio:            null,
    /* Block them from any role-gated actions even if a session
       somehow stays alive. */
    banned:         true,
    available:      false,
    updatedAt:      now,
  }, { merge: true });

  /* Disable in Firebase Auth + revoke refresh tokens. Two separate
     calls so a failure in one (e.g. user already deleted from Auth
     but still has a Firestore doc) doesn't block the other. */
  try {
    await adminAuth().updateUser(body.uid, { disabled: true });
  } catch (err) {
    console.warn('[admin.user.soft_delete] updateUser failed', err);
  }
  try {
    await adminAuth().revokeRefreshTokens(body.uid);
  } catch (err) {
    console.warn('[admin.user.soft_delete] revokeRefreshTokens failed', err);
  }

  await audit({
    actor:  admin.uid,
    action: 'admin.user.soft_delete',
    target: body.uid,
    meta:   { reason: body.reason },
  });

  return NextResponse.json({ ok: true });
});
