/**
 * POST /api/admin/users/promote
 *
 * Super-admin only. Grants the `admin` custom claim plus a tier
 * (super | manager | ops) to a user.
 *
 * Custom claims propagate via Firebase Auth — the user must reauthenticate
 * (or call `getIdToken(true)` to force refresh) for new claims to land in
 * their token. The session cookie they have continues to work but won't
 * reflect the new claim until session-login is re-issued.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, uidSchema, notFound } from '@/lib/api';

const Body = z.object({
  uid:  uidSchema,
  role: z.enum(['super', 'manager', 'ops']),
});

export const POST = handler(async (req: NextRequest) => {
  const actor = await requireAdmin(req, ['super']);
  const { uid, role } = await parseBody(req, Body);

  const target = await adminAuth().getUser(uid).catch(() => null);
  if (!target) throw notFound(`User ${uid} not found`);

  await adminAuth().setCustomUserClaims(uid, { admin: true, role });
  await adminDb().collection('users').doc(uid).set(
    { adminRole: role, isAdmin: true, updatedAt: new Date() },
    { merge: true },
  );
  await adminAuth().revokeRefreshTokens(uid); /* force the user to re-login to pick up claims */

  await audit({
    actor: actor.uid,
    action: 'admin.promote',
    target: uid,
    meta:   { role },
  });

  return NextResponse.json({ ok: true });
});
