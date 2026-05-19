/**
 * POST /api/safepay/refund
 *
 * Admin-only. Refunds a confirmed payment. Used when:
 *   - Client cancels before artisan starts work
 *   - Dispute resolution favours the client
 *   - Artisan no-show
 *
 * State transitions valid input states:
 *   confirmed | in_progress | completed → refunded
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, uidSchema, dzdAmountSchema, notFound, conflict, badRequest } from '@/lib/api';

const Body = z.object({
  missionId: uidSchema,
  amount:    dzdAmountSchema.optional(),  /* defaults to mission.paidAmount */
  reason:    z.enum(['client_cancel', 'no_show', 'dispute', 'other']),
  note:      z.string().max(500).optional(),
});

const REFUNDABLE_STATES = ['confirmed', 'in_progress', 'completed'] as const;

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const { missionId, amount, reason, note } = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    const mRef  = adminDb().collection('missions').doc(missionId);
    const mSnap = await tx.get(mRef);
    if (!mSnap.exists) throw notFound(`Mission ${missionId} not found`);

    const m = mSnap.data() as Record<string, any>;
    if (!REFUNDABLE_STATES.includes(m.status)) {
      throw conflict(`Mission status is ${m.status}; only ${REFUNDABLE_STATES.join('/')} are refundable`);
    }

    const paid     = Number(m.paidAmount ?? 0);
    const refundAmt = amount ?? paid;
    if (refundAmt <= 0)      throw badRequest('Refund amount must be positive');
    if (refundAmt > paid)    throw badRequest(`Refund (${refundAmt}) exceeds paid (${paid})`);

    const now   = Timestamp.now();
    const txDoc = adminDb().collection('transactions').doc();

    tx.update(mRef, {
      status:        'refunded',
      refundedAt:    now,
      refundedBy:    admin.uid,
      refundAmount:  refundAmt,
      refundReason:  reason,
      updatedAt:     now,
    });

    tx.set(txDoc, {
      kind:       'refund',
      missionId,
      userId:     m.clientId,
      amount:    -refundAmt,  /* negative — cash going out */
      reason,
      note:       note ?? null,
      partial:    refundAmt < paid,
      recordedBy: admin.uid,
      createdAt:  now,
    });

    return { txId: txDoc.id, amount: refundAmt };
  });

  await audit({
    actor:  admin.uid,
    action: 'safepay.refund',
    target: missionId,
    meta:   { ...result, reason },
  });

  return NextResponse.json({ ok: true, ...result });
});
