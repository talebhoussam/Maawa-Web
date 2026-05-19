/**
 * POST /api/artisan/mission/complete
 *
 * Artisan marks a mission as complete. Status moves from 'in_progress'
 * to 'terminee'. Both parties get notified — the client gets a rating
 * prompt (Group B work picks this up; for now we just write the
 * notif, the rating flow lands later).
 *
 * Body: { missionId: string }
 *
 * Pre-conditions:
 *   - Mission exists.
 *   - Caller is the assigned artisan.
 *   - Current status === 'in_progress'.
 *
 * Side effect:
 *   - status='terminee', completedAt=now.
 *   - Notification to client (kind='mission_completed').
 *
 * We DON'T credit `users/{artisan}.payableBalance` here. SafePay
 * release is a separate workflow tied to the client's confirm-payment
 * action, and that ships with the bidirectional-ratings work (Group B).
 *
 * Audit: `mission.completed`.
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
    const ref  = adminDb().collection('missions').doc(body.missionId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound(`Mission ${body.missionId} not found`);

    const mission = snap.data() as Record<string, unknown>;
    if (mission.artisanId !== user.uid) {
      throw forbidden('Only the assigned artisan can complete this mission');
    }
    if (mission.status !== 'in_progress') {
      throw conflict(`Mission status is ${mission.status}, cannot complete`);
    }

    const now = Timestamp.now();
    tx.update(ref, {
      status:      'terminee',
      completedAt: now,
      updatedAt:   now,
    });

    if (typeof mission.clientId === 'string') {
      tx.set(adminDb().collection('notifications').doc(), {
        userId:    mission.clientId,
        kind:      'mission_completed',
        actorId:   user.uid,
        missionId: body.missionId,
        unread:    true,
        createdAt: now,
      });
    }
    return { clientId: mission.clientId };
  });

  await audit({
    actor:  user.uid,
    action: 'mission.completed',
    target: body.missionId,
    meta:   { clientId: result.clientId },
  });

  return NextResponse.json({ ok: true });
});
