/**
 * POST /api/wallet/payout-request
 *
 * Artisan submits a withdrawal request. Validates balance is
 * sufficient AT REQUEST TIME but does NOT debit yet — the debit
 * happens only when an admin approves. This mirrors the coin
 * purchase pattern (off-platform money movement, server confirms).
 *
 * Body: {
 *   amountDZD: integer 1000..1000000,
 *   method:    'ccp' | 'baridimob' | 'cash_pickup',
 *   accountInfo: string (≤ 200 chars) — CCP number, Baridimob phone,
 *                or pickup-location note
 * }
 *
 * Audit: `payout.requested`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAuth, audit, forbidden, badRequest,
} from '@/lib/api';

const Body = z.object({
  amountDZD:   z.number().int().min(1000).max(1_000_000),
  method:      z.enum(['ccp', 'baridimob', 'cash_pickup']),
  accountInfo: z.string().min(3).max(200),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  /* Verify caller is an artisan with enough balance. */
  const userRef = adminDb().collection('users').doc(user.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw forbidden('Profile not found');
  const userData = userSnap.data() as Record<string, unknown>;
  if (userData.role !== 'artisan') throw forbidden('Only artisans can request payouts');

  const balance = typeof userData.payableBalance === 'number' ? userData.payableBalance : 0;
  if (balance < body.amountDZD) {
    throw badRequest(`Solde insuffisant (disponible: ${balance.toLocaleString('fr-FR')} DZD)`);
  }

  /* Refuse if the artisan already has an open request. Avoids the
     "click-spam → 3 pending requests" failure mode. */
  const openSnap = await adminDb()
    .collection('payout_requests')
    .where('userId', '==', user.uid)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (!openSnap.empty) {
    throw badRequest('Une demande de retrait est déjà en attente');
  }

  const ref = adminDb().collection('payout_requests').doc();
  await ref.set({
    userId:      user.uid,
    amountDZD:   body.amountDZD,
    method:      body.method,
    accountInfo: body.accountInfo,
    status:      'pending',
    createdAt:   Timestamp.now(),
    reviewedBy:  null,
    reviewedAt:  null,
    reviewNote:  null,
  });

  await audit({
    actor:  user.uid,
    action: 'payout.requested',
    target: ref.id,
    meta:   { amountDZD: body.amountDZD, method: body.method },
  });

  return NextResponse.json({ ok: true, requestId: ref.id });
});
