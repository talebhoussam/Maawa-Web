/**
 * POST /api/artisan/mission/accept
 *
 * Artisan accepts an incoming mission. Transitions status from
 * 'pending' (no artisan assigned yet) to 'confirmed' (this artisan
 * is now the owner).
 *
 * Body: { missionId: string }
 *
 * Pre-conditions enforced in the transaction:
 *   - Mission exists and status === 'pending'.
 *   - Mission has no artisanId set yet (or has the caller's uid —
 *     handles the rare case where the client pre-targeted them).
 *   - Caller's user doc has role:'artisan' and verified === true
 *     (this is the "verified by Maawa" gate — unverified artisans
 *     can't accept missions even if they're flagged as artisans).
 *
 * Side effects:
 *   - Sets artisanId, status, confirmedAt.
 *   - Bumps the mission's `assignedAt` so the client UI can sort.
 *   - Writes a notification to the client.
 *
 * Audit: `mission.accepted`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAuth, audit,
  notFound, conflict, forbidden,
} from '@/lib/api';

const Body = z.object({
  missionId: z.string().min(1).max(80),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    /* Verify the caller is an approved artisan. */
    const userRef  = adminDb().collection('users').doc(user.uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw forbidden('Profile not found');
    const userData = userSnap.data() as Record<string, unknown>;
    if (userData.role !== 'artisan') throw forbidden('Not an artisan');
    if (userData.verified !== true)  throw forbidden('Artisan not yet verified by Maawa');

    /* Verify mission is acceptable. */
    const missionRef = adminDb().collection('missions').doc(body.missionId);
    const missionSnap = await tx.get(missionRef);
    if (!missionSnap.exists) throw notFound(`Mission ${body.missionId} not found`);

    const mission = missionSnap.data() as Record<string, unknown>;
    if (mission.status !== 'pending') {
      throw conflict(`Mission status is ${mission.status}, cannot accept`);
    }
    if (mission.artisanId && mission.artisanId !== user.uid) {
      throw conflict('Mission already assigned to another artisan');
    }

    const now = Timestamp.now();
    tx.update(missionRef, {
      artisanId:   user.uid,
      status:      'confirmed',
      assignedAt:  now,
      confirmedAt: now,
      updatedAt:   now,
    });

    /* Notify the client. */
    if (typeof mission.clientId === 'string') {
      const notifRef = adminDb().collection('notifications').doc();
      tx.set(notifRef, {
        userId:     mission.clientId,
        kind:       'mission_accepted',
        actorId:    user.uid,
        missionId:  body.missionId,
        unread:     true,
        createdAt:  now,
      });
    }

    return { clientId: mission.clientId };
  });

  await audit({
    actor:  user.uid,
    action: 'mission.accepted',
    target: body.missionId,
    meta:   { clientId: result.clientId },
  });

  return NextResponse.json({ ok: true });
});
