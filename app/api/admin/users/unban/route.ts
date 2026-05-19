/**
 * POST /api/admin/users/unban
 *
 * Reverse a previous soft-delete / ban on a user. Sets:
 *   - banned    = false
 *   - deleted   = false
 *   - Restores Auth account via adminAuth().updateUser({ disabled: false }).
 *
 * The deletedReason / bannedAt fields stay on the doc as historical
 * context — the audit row records the unban so we know who undid it.
 *
 * Body: { uid: string, reason: string (≥5, ≤500) }
 * Audit: `admin.user.unban`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
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

  const ref = adminDb().collection('users').doc(body.uid);
  const snap = await ref.get();
  if (!snap.exists) throw notFound(`User ${body.uid} not found`);
  const user = snap.data() as Record<string, unknown>;
  if (user.banned !== true && user.deleted !== true) {
    throw conflict('User is not currently banned/deleted');
  }

  const now = Timestamp.now();
  await ref.set({
    banned:     false,
    deleted:    false,
    unbannedAt: now,
    unbannedBy: admin.uid,
  }, { merge: true });

  /* Restore Auth account. Wrap in try — if the auth user was hard-
     deleted, just record the Firestore restoration. */
  try {
    await adminAuth().updateUser(body.uid, { disabled: false });
  } catch (err) {
    console.warn('[user.unban] auth restore failed', err);
  }

  await audit({
    actor:  admin.uid,
    action: 'admin.user.unban',
    target: body.uid,
    meta:   { reason: body.reason },
  });

  return NextResponse.json({ ok: true });
});
