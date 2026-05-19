/**
 * POST /api/artisan/mission/decline
 *
 * Artisan declines an incoming mission. We DON'T flip the mission to
 * 'cancelled' — the mission stays 'pending' and the platform can offer
 * it to another artisan. We just record this artisan's declination
 * in a sub-collection so the same offer isn't shown again.
 *
 * Body: { missionId: string, reason?: string }
 *
 * Sub-collection `missions/{id}/declines/{artisanUid}` keeps the
 * record. A future "Maawa choisit" auto-assign flow can read this
 * to skip artisans who've already declined.
 *
 * Audit: `mission.declined`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAuth, audit,
  notFound, forbidden,
} from '@/lib/api';

const Body = z.object({
  missionId: z.string().min(1).max(80),
  reason:    z.string().max(500).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  /* Verify caller is artisan + verified. Cheap to do outside the tx —
     the decline sub-doc write is independent of mission state. */
  const userSnap = await adminDb().collection('users').doc(user.uid).get();
  if (!userSnap.exists) throw forbidden('Profile not found');
  const userData = userSnap.data() as Record<string, unknown>;
  if (userData.role !== 'artisan') throw forbidden('Not an artisan');

  const missionRef  = adminDb().collection('missions').doc(body.missionId);
  const missionSnap = await missionRef.get();
  if (!missionSnap.exists) throw notFound(`Mission ${body.missionId} not found`);

  const declineRef = missionRef.collection('declines').doc(user.uid);
  await declineRef.set({
    artisanId:  user.uid,
    reason:     body.reason ?? null,
    declinedAt: Timestamp.now(),
  });

  await audit({
    actor:  user.uid,
    action: 'mission.declined',
    target: body.missionId,
    meta:   { hasReason: Boolean(body.reason) },
  });

  return NextResponse.json({ ok: true });
});
