/**
 * POST /api/artisan/mission/start
 *
 * Artisan flips a mission from 'confirmed' to 'in_progress' — they're
 * actively working on site. This is a one-way transition; rolling back
 * requires admin intervention (which happens via the moderation
 * pages, not this route).
 *
 * Body: { missionId: string }
 *
 * Pre-conditions enforced in the transaction:
 *   - Mission exists.
 *   - Caller's uid is the assigned artisan.
 *   - Current status === 'confirmed'.
 *
 * Side effect:
 *   - Sets status='in_progress', startedAt=now.
 *   - Notifies the client so the calendar/missions page picks it up.
 *
 * Audit: `mission.started`.
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
      throw forbidden('Only the assigned artisan can start this mission');
    }
    if (mission.status !== 'confirmed') {
      throw conflict(`Mission status is ${mission.status}, cannot start`);
    }

    const now = Timestamp.now();
    tx.update(ref, {
      status:    'in_progress',
      startedAt: now,
      updatedAt: now,
    });

    /* Notify the client. */
    if (typeof mission.clientId === 'string') {
      tx.set(adminDb().collection('notifications').doc(), {
        userId:    mission.clientId,
        kind:      'mission_started',
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
    action: 'mission.started',
    target: body.missionId,
    meta:   { clientId: result.clientId },
  });

  return NextResponse.json({ ok: true });
});
