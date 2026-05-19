/**
 * POST /api/me/artisan-profile
 *
 * Update the artisan-specific profile fields. Plain clients calling
 * this get 403 — they don't have these fields.
 *
 * Body (all optional, you can patch one field at a time):
 *   trade?:        string (≤ 80 chars) — main trade name (e.g. "Plomberie")
 *   experience?:   integer 0..60 — years of experience
 *   hourlyRate?:   integer 0..100000 — DZD per hour
 *   serviceAreas?: string[] (1..58 entries) — wilaya labels they cover
 *   bio?:          string (≤ 1000 chars)
 *
 * The user doc rule already whitelists these fields for self-update.
 * Doing it through this route gives us:
 *   - One place that enforces the artisan-only constraint server-side.
 *   - An audit row for any rate / coverage change.
 *
 * Audit: `artisan.profile.update` with meta listing which fields changed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAuth, audit,
  forbidden, badRequest,
} from '@/lib/api';

const Body = z.object({
  trade:        z.string().min(1).max(80).optional(),
  experience:   z.number().int().min(0).max(60).optional(),
  hourlyRate:   z.number().int().min(0).max(100000).optional(),
  /* serviceAreas is a wilaya labels list. Cap at 58 — Algeria's
     entire administrative subdivision. Empty array allowed → "any
     area". */
  serviceAreas: z.array(z.string().min(1).max(80)).max(58).optional(),
  bio:          z.string().max(1000).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  /* Refuse no-op calls — saves a write + makes auditing meaningful. */
  const keys = Object.keys(body) as Array<keyof typeof body>;
  if (keys.length === 0) throw badRequest('Empty update');

  const userRef  = adminDb().collection('users').doc(user.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw forbidden('Profile not found');
  const userData = userSnap.data() as Record<string, unknown>;
  if (userData.role !== 'artisan') {
    throw forbidden('Only artisans have a craft profile');
  }

  /* Build a patch with only the supplied keys (Zod made them all
     optional). Coerce serviceAreas to a deduped sorted list so
     downstream queries are stable. */
  const patch: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  if (body.trade        !== undefined) patch.trade        = body.trade.trim();
  if (body.experience   !== undefined) patch.experience   = body.experience;
  if (body.hourlyRate   !== undefined) patch.hourlyRate   = body.hourlyRate;
  if (body.serviceAreas !== undefined) {
    patch.serviceAreas = Array.from(new Set(body.serviceAreas.map(s => s.trim()))).sort();
  }
  if (body.bio          !== undefined) patch.bio          = body.bio.trim();

  await userRef.set(patch, { merge: true });

  await audit({
    actor:  user.uid,
    action: 'artisan.profile.update',
    target: user.uid,
    meta:   { fields: keys },
  });

  return NextResponse.json({ ok: true });
});
