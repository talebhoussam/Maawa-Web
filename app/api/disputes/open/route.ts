/**
 * POST /api/disputes/open
 *
 * Either party of a mission opens a formal dispute. We don't need a
 * server route strictly — the rule allows direct create — but doing
 * it through the API gives us:
 *   - server-side enforcement that the caller participated in the
 *     mission and the mission is in a state where disputes make sense
 *     (confirmed / in_progress / terminee — not pending or cancelled).
 *   - automatic resolution of `againstUid` from the mission doc, so
 *     the caller can't lie about who they're disputing.
 *   - audit row + admin notification.
 *
 * Body: {
 *   missionId: string,
 *   reason:    enum,
 *   note?:     string (≤ 1000 chars)
 * }
 *
 * Audit: `dispute.opened` with meta={missionId, againstUid, reason}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAuth, audit,
  notFound, conflict, forbidden,
} from '@/lib/api';

const REASONS = ['no_show', 'incomplete_work', 'damage', 'overcharge', 'unsafe', 'payment_issue', 'other'] as const;

const Body = z.object({
  missionId: z.string().min(1).max(80),
  reason:    z.enum(REASONS),
  note:      z.string().max(1000).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const missionRef = adminDb().collection('missions').doc(body.missionId);
  const missionSnap = await missionRef.get();
  if (!missionSnap.exists) throw notFound(`Mission ${body.missionId} not found`);
  const mission = missionSnap.data() as Record<string, unknown>;

  /* Caller must be one of the two participants. */
  const clientId  = typeof mission.clientId  === 'string' ? mission.clientId  : null;
  const artisanId = typeof mission.artisanId === 'string' ? mission.artisanId : null;
  if (user.uid !== clientId && user.uid !== artisanId) {
    throw forbidden('Only mission participants can open a dispute');
  }
  if (!clientId || !artisanId) {
    throw conflict('Cannot dispute a mission without an assigned artisan');
  }

  /* Status guard. Disputes don't make sense before any work happened
     (pending) or after the mission is dead (cancelled). */
  const validStates = ['confirmed', 'in_progress', 'terminee'];
  if (!validStates.includes(String(mission.status))) {
    throw conflict(`Cannot open a dispute on a mission in status '${mission.status}'`);
  }

  const againstUid = user.uid === clientId ? artisanId : clientId;

  /* Refuse duplicates — one open dispute per mission per claimant. */
  const dupSnap = await adminDb().collection('disputes')
    .where('missionId', '==', body.missionId)
    .where('openedBy', '==', user.uid)
    .where('status', 'in', ['open', 'reviewing'])
    .limit(1)
    .get();
  if (!dupSnap.empty) {
    throw conflict('Vous avez déjà un litige en cours sur cette mission');
  }

  const now = Timestamp.now();
  const ref = adminDb().collection('disputes').doc();
  await ref.set({
    missionId:  body.missionId,
    openedBy:   user.uid,
    againstUid,
    reason:     body.reason,
    note:       body.note ?? null,
    status:     'open',
    createdAt:  now,
    reviewedBy: null,
    reviewedAt: null,
    resolution: null,
  });

  await audit({
    actor:  user.uid,
    action: 'dispute.opened',
    target: ref.id,
    meta:   { missionId: body.missionId, againstUid, reason: body.reason },
  });

  return NextResponse.json({ ok: true, disputeId: ref.id });
});
