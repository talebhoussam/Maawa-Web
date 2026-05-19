/**
 * POST /api/admin/disputes/resolve
 *
 * Admin moves a dispute to a terminal state. Three outcomes:
 *   - 'dismiss'  — no action taken; opener and target unchanged.
 *   - 'favor_opener'  — admin sided with the claimant. We record the
 *                       decision; any SafePay refund or rating
 *                       adjustment is operator-driven for now (no
 *                       automated money movement).
 *   - 'favor_against' — admin sided with the other party.
 *
 * The action notes are persisted on the dispute doc + audit log so
 * future SLA / appeal flows have the history.
 *
 * Body: {
 *   disputeId: string,
 *   outcome:   'dismiss' | 'favor_opener' | 'favor_against',
 *   resolution: string (≥ 5 chars, ≤ 1000)
 * }
 *
 * Audit: `admin.dispute.resolved`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound, conflict,
} from '@/lib/api';

const Body = z.object({
  disputeId:  z.string().min(1).max(80),
  outcome:    z.enum(['dismiss', 'favor_opener', 'favor_against']),
  resolution: z.string().min(5).max(1000),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const ref = adminDb().collection('disputes').doc(body.disputeId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound(`Dispute ${body.disputeId} not found`);
  const d = snap.data() as Record<string, unknown>;
  if (d.status === 'resolved' || d.status === 'dismissed') {
    throw conflict(`Dispute already ${d.status}`);
  }

  const now = Timestamp.now();
  await ref.set({
    status:     body.outcome === 'dismiss' ? 'dismissed' : 'resolved',
    outcome:    body.outcome,
    reviewedBy: admin.uid,
    reviewedAt: now,
    resolution: body.resolution,
  }, { merge: true });

  /* Notify both parties so they know it's been handled. */
  const openedBy   = typeof d.openedBy   === 'string' ? d.openedBy   : null;
  const againstUid = typeof d.againstUid === 'string' ? d.againstUid : null;
  for (const uid of [openedBy, againstUid]) {
    if (!uid) continue;
    await adminDb().collection('notifications').add({
      userId:    uid,
      kind:      'dispute_resolved',
      actorId:   admin.uid,
      disputeId: body.disputeId,
      outcome:   body.outcome,
      unread:    true,
      createdAt: now,
    });
  }

  await audit({
    actor:  admin.uid,
    action: 'admin.dispute.resolved',
    target: body.disputeId,
    meta:   { outcome: body.outcome, missionId: d.missionId ?? null },
  });

  return NextResponse.json({ ok: true });
});
