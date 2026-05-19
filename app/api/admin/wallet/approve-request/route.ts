/**
 * POST /api/admin/wallet/approve-request
 *
 * Admin approves a pending coin-purchase request. Inside one Firestore
 * transaction we:
 *   1. Read the request, verify status === 'pending'.
 *   2. Flip status to 'approved' + write reviewer metadata.
 *   3. Increment users/{userId}.maawaCoinBalance by amountMC.
 *   4. Create a transactions doc of kind 'coin_purchase'.
 *
 * The transaction guarantees we don't double-credit a user when two
 * admins approve the same request concurrently — step (1) re-checks
 * the status inside the tx and bails on a stale read.
 *
 * Body: { requestId: string, note?: string }
 *
 * Audit: `admin.coin.approve` with meta={requestId,userId,amountMC,txId}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound, conflict,
} from '@/lib/api';

const Body = z.object({
  requestId: z.string().min(1).max(80),
  note:      z.string().max(500).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    const reqRef  = adminDb().collection('coin_purchase_requests').doc(body.requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists) throw notFound(`Request ${body.requestId} not found`);

    const r = reqSnap.data() as Record<string, unknown>;
    if (r.status !== 'pending') {
      throw conflict(`Request status is ${r.status}, not pending`);
    }

    const amountMC = Number(r.amountMC);
    if (!Number.isInteger(amountMC) || amountMC < 100 || amountMC > 10000) {
      /* This shouldn't happen — the create-rule enforces the range — but
         we re-validate inside the tx because we're about to credit MC
         to a user. Belt-and-braces. */
      throw conflict('Request has invalid amountMC; cannot credit');
    }
    const userId = String(r.userId);
    if (!userId) throw conflict('Request has no userId');

    const userRef = adminDb().collection('users').doc(userId);
    const txDoc   = adminDb().collection('transactions').doc();
    const now     = Timestamp.now();

    /* Flip request to approved. */
    tx.update(reqRef, {
      status:     'approved',
      reviewedAt: now,
      reviewedBy: admin.uid,
      reviewNote: body.note ?? null,
    });

    /* Atomically increment the user's MC balance. FieldValue.increment
       handles concurrent updates safely on the server side. */
    tx.set(userRef, {
      maawaCoinBalance: FieldValue.increment(amountMC),
      updatedAt: now,
    }, { merge: true });

    /* Audit-friendly transaction row. `missionId: null` distinguishes
       coin-purchase credits from mission-payment credits. */
    tx.set(txDoc, {
      kind:       'coin_purchase',
      userId,
      amount:     amountMC,        /* positive — credit */
      missionId:  null,
      requestId:  body.requestId,
      recordedBy: admin.uid,
      createdAt:  now,
    });

    return { txId: txDoc.id, userId, amountMC };
  });

  await audit({
    actor:  admin.uid,
    action: 'admin.coin.approve',
    target: body.requestId,
    meta: {
      userId:   result.userId,
      amountMC: result.amountMC,
      txId:     result.txId,
    },
  });

  return NextResponse.json({ ok: true, txId: result.txId });
});
