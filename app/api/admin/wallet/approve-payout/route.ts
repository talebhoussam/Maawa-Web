/**
 * POST /api/admin/wallet/approve-payout
 *
 * Admin approves a payout request. Inside ONE transaction:
 *   1. Re-read the request — refuse if status !== 'pending'.
 *   2. Re-read the artisan's balance (it might have changed since
 *      submission). Refuse if insufficient.
 *   3. Debit `payableBalance` by amountDZD.
 *   4. Flip request status to 'approved' with reviewer + timestamp.
 *   5. Write a `transactions` ledger entry kind='payout'.
 *
 * The actual money transfer (CCP / Baridimob / cash) happens
 * off-platform; this route just records that the admin confirmed
 * doing it.
 *
 * Body: { requestId: string, note?: string (≤ 500 chars) }
 * Audit: `admin.payout.approved`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  notFound, conflict, badRequest,
} from '@/lib/api';

const Body = z.object({
  requestId: z.string().min(1).max(80),
  note:      z.string().max(500).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    const reqRef = adminDb().collection('payout_requests').doc(body.requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists) throw notFound(`Request ${body.requestId} not found`);
    const reqData = reqSnap.data() as Record<string, unknown>;
    if (reqData.status !== 'pending') {
      throw conflict(`Request is ${reqData.status}, cannot approve`);
    }

    const userId    = String(reqData.userId);
    const amountDZD = Number(reqData.amountDZD ?? 0);
    if (amountDZD <= 0) throw badRequest('Invalid amount on request');

    const userRef = adminDb().collection('users').doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw notFound(`User ${userId} not found`);
    const userData = userSnap.data() as Record<string, unknown>;
    const balance  = typeof userData.payableBalance === 'number' ? userData.payableBalance : 0;
    if (balance < amountDZD) {
      throw badRequest(`Solde insuffisant (disponible: ${balance.toLocaleString('fr-FR')} DZD)`);
    }

    const now = Timestamp.now();

    /* Debit + flip status. */
    tx.set(userRef, {
      payableBalance: balance - amountDZD,
      updatedAt:      now,
    }, { merge: true });

    tx.set(reqRef, {
      status:     'approved',
      reviewedBy: admin.uid,
      reviewedAt: now,
      reviewNote: body.note ?? null,
    }, { merge: true });

    /* Ledger entry — same shape /artisan/earnings reads. */
    const txnRef = adminDb().collection('transactions').doc();
    tx.set(txnRef, {
      userId,
      kind:      'payout',
      amount:    amountDZD,
      type:      'debit',
      requestId: body.requestId,
      createdAt: now,
    });

    return { userId, amountDZD };
  });

  await audit({
    actor:  admin.uid,
    action: 'admin.payout.approved',
    target: body.requestId,
    meta:   { userId: result.userId, amountDZD: result.amountDZD, note: body.note ?? null },
  });

  return NextResponse.json({ ok: true });
});
