/**
 * POST /api/ratings/submit
 *
 * Submit a star rating after a completed mission. Bidirectional:
 *   - Client rates the artisan (kind: 'client_to_artisan').
 *   - Artisan rates the client (kind: 'artisan_to_client').
 *
 * Body: {
 *   missionId: string,
 *   stars:     integer 1..5,
 *   comment?:  string (≤ 500 chars)
 * }
 *
 * Pre-conditions enforced in the transaction:
 *   - Mission exists, status === 'terminee'.
 *   - Caller is one of {mission.clientId, mission.artisanId}.
 *   - No prior rating from this rater on this mission (composite-id
 *     doc /ratings/{missionId}_{raterId} — set with create-only).
 *
 * Side-effects in the same transaction:
 *   - Writes /ratings/{missionId}_{raterId} doc.
 *   - Recomputes the ratee's running average: reads their current
 *     `rating` (avg) and `reviewCount`, computes the new mean, writes
 *     the merged values back. This keeps the avg accurate without a
 *     scheduled aggregation job.
 *   - Stamps `missions/{id}.clientRatedAt` or `.artisanRatedAt` so
 *     the UI knows which prompt is still pending.
 *
 * Audit: `rating.submitted` with kind + stars + missionId.
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
  stars:     z.number().int().min(1).max(5),
  comment:   z.string().max(500).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const ratingId  = `${body.missionId}_${user.uid}`;
  const ratingRef = adminDb().collection('ratings').doc(ratingId);
  const missionRef = adminDb().collection('missions').doc(body.missionId);

  const result = await adminDb().runTransaction(async (tx) => {
    /* Order matters: Firestore needs all reads before writes. */
    const [missionSnap, ratingSnap] = await Promise.all([
      tx.get(missionRef),
      tx.get(ratingRef),
    ]);

    if (!missionSnap.exists) throw notFound(`Mission ${body.missionId} not found`);
    const mission = missionSnap.data() as Record<string, unknown>;
    if (mission.status !== 'terminee') {
      throw conflict('Vous pouvez noter uniquement après la fin de la mission');
    }
    if (ratingSnap.exists) {
      throw conflict('Vous avez déjà évalué cette mission');
    }

    /* Determine kind + ratee. */
    let kind: 'client_to_artisan' | 'artisan_to_client';
    let ratedId: string;
    if (mission.clientId === user.uid) {
      if (typeof mission.artisanId !== 'string') throw conflict('No artisan on this mission');
      kind = 'client_to_artisan';
      ratedId = mission.artisanId;
    } else if (mission.artisanId === user.uid) {
      if (typeof mission.clientId !== 'string') throw conflict('No client on this mission');
      kind = 'artisan_to_client';
      ratedId = mission.clientId;
    } else {
      throw forbidden('You did not participate in this mission');
    }

    /* Read the ratee's current aggregate inside the same tx. */
    const ratedRef = adminDb().collection('users').doc(ratedId);
    const ratedSnap = await tx.get(ratedRef);
    const ratedData = ratedSnap.exists ? ratedSnap.data() as Record<string, unknown> : {};
    const oldAvg   = typeof ratedData.rating       === 'number' ? ratedData.rating       : 0;
    const oldCount = typeof ratedData.reviewCount  === 'number' ? ratedData.reviewCount  : 0;
    const newCount = oldCount + 1;
    /* New running mean — clamp to 1 decimal for display predictability. */
    const newAvgRaw = (oldAvg * oldCount + body.stars) / newCount;
    const newAvg = Math.round(newAvgRaw * 10) / 10;

    const now = Timestamp.now();

    /* All writes after this point. */
    tx.set(ratingRef, {
      missionId: body.missionId,
      raterId:   user.uid,
      ratedId,
      stars:     body.stars,
      comment:   body.comment ?? null,
      kind,
      createdAt: now,
    });

    tx.set(ratedRef, {
      rating:       newAvg,
      reviewCount:  newCount,
      updatedAt:    now,
    }, { merge: true });

    /* Mark on the mission which side has rated. */
    tx.update(missionRef, {
      [kind === 'client_to_artisan' ? 'clientRatedAt' : 'artisanRatedAt']: now,
      updatedAt: now,
    });

    /* Notification for the ratee so they see the new review. */
    tx.set(adminDb().collection('notifications').doc(), {
      userId:    ratedId,
      kind:      'new_rating',
      actorId:   user.uid,
      missionId: body.missionId,
      stars:     body.stars,
      unread:    true,
      createdAt: now,
    });

    return { kind, ratedId, newAvg, newCount };
  });

  await audit({
    actor:  user.uid,
    action: 'rating.submitted',
    target: body.missionId,
    meta:   { kind: result.kind, stars: body.stars, ratedId: result.ratedId, newAvg: result.newAvg, newCount: result.newCount },
  });

  return NextResponse.json({ ok: true, newAvg: result.newAvg, newCount: result.newCount });
});
