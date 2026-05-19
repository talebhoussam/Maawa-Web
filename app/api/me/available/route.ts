/**
 * POST /api/me/available
 *
 * Flip the caller's `available` flag (artisan-only). Plain clients
 * don't need this — they're always "available" to request services.
 *
 * Used by the artisan dashboard's "Passer hors ligne" / "Passer en
 * ligne" toggle so the artisan can stop receiving new mission offers
 * without leaving the platform. The Maawa Support bot's wilaya query
 * filters on `available==true`, so flipping this immediately removes
 * the artisan from auto-suggest results.
 *
 * Body: { available: boolean }
 * Audit: `artisan.available` with meta={available}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAuth, audit, forbidden,
} from '@/lib/api';

const Body = z.object({
  available: z.boolean(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const userRef  = adminDb().collection('users').doc(user.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw forbidden('Profile not found');
  const userData = userSnap.data() as Record<string, unknown>;
  if (userData.role !== 'artisan') throw forbidden('Only artisans have an availability toggle');

  await userRef.set({
    available: body.available,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  await audit({
    actor:  user.uid,
    action: 'artisan.available',
    target: user.uid,
    meta:   { available: body.available },
  });

  return NextResponse.json({ ok: true, available: body.available });
});
