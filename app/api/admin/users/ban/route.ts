/**
 * POST /api/admin/users/ban
 *
 * Admin (super or manager). Disables a user's Firebase Auth account so
 * they cannot sign in, and revokes all current sessions. Sets a flag in
 * the user document for UI display purposes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, uidSchema, notFound, badRequest } from '@/lib/api';

const Body = z.object({
  uid:    uidSchema,
  reason: z.string().min(3).max(500),
  unban:  z.boolean().optional().default(false),
});

export const POST = handler(async (req: NextRequest) => {
  const actor = await requireAdmin(req, ['super', 'manager']);
  const { uid, reason, unban } = await parseBody(req, Body);

  if (uid === actor.uid) throw badRequest('Cannot ban yourself');

  const target = await adminAuth().getUser(uid).catch(() => null);
  if (!target) throw notFound(`User ${uid} not found`);

  await adminAuth().updateUser(uid, { disabled: !unban });
  if (!unban) await adminAuth().revokeRefreshTokens(uid);

  await adminDb().collection('users').doc(uid).set({
    banned:      !unban,
    banReason:   unban ? null : reason,
    bannedAt:    unban ? null : Timestamp.now(),
    bannedBy:    unban ? null : actor.uid,
    updatedAt:   Timestamp.now(),
  }, { merge: true });

  await audit({
    actor:  actor.uid,
    action: unban ? 'admin.user.unban' : 'admin.user.ban',
    target: uid,
    meta:   { reason },
  });

  return NextResponse.json({ ok: true });
});
