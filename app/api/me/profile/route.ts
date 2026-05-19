/**
 * GET  /api/me/profile  — fetch own profile
 * PUT  /api/me/profile  — update own profile (whitelist of safe fields)
 *
 * Why a server route instead of direct Firestore?
 *   - Server validates the field whitelist (client can't sneak `role`
 *     or `verified` or `maawaCoinBalance` into the update).
 *   - Centralized audit + Sentry breadcrumb.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, notFound } from '@/lib/api';

/* Only fields the user can self-edit. role/verified/banned/balance live
   here intentionally NOT whitelisted. */
const UpdateBody = z.object({
  displayName: z.string().min(1).max(80).optional(),
  firstName:   z.string().min(1).max(40).optional(),
  lastName:    z.string().min(1).max(40).optional(),
  wilaya:      z.string().min(1).max(80).optional(),
  bio:         z.string().max(500).optional(),
  trade:       z.string().max(80).optional(),  /* artisan-only */
  experience:  z.number().int().min(0).max(60).optional(),
  available:   z.boolean().optional(),
}).strict();  /* extra fields are rejected, not silently dropped */

export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const snap = await adminDb().collection('users').doc(user.uid).get();
  if (!snap.exists) throw notFound('Profile not found');

  const data = snap.data() as Record<string, unknown>;
  /* Strip server-internal fields before returning. */
  delete data.banReason;
  delete data.bannedBy;
  delete data.bannedAt;

  return NextResponse.json({ profile: { uid: user.uid, ...data } });
});

export const PUT = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, UpdateBody);

  const ref = adminDb().collection('users').doc(user.uid);
  await ref.set({ ...body, updatedAt: Timestamp.now() }, { merge: true });

  return NextResponse.json({ ok: true });
});
