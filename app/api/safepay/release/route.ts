/**
 * POST /api/safepay/release
 *
 * Admin-only (or eventually: client-confirmed via mission update).
 * Releases escrowed funds to the artisan after the client has marked
 * the mission completed.
 *
 * State transition: completed → released
 * Side effects:
 *   - Decrements platform commission from gross
 *   - Credits the artisan's payable balance (paid out separately later)
 *   - Logs an audit entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, uidSchema, notFound, conflict } from '@/lib/api';
import { serverEnv } from '@/lib/env';

const Body = z.object({
  missionId: uidSchema,
  note:      z.string().max(500).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const { missionId, note } = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    const mRef  = adminDb().collection('missions').doc(missionId);
    const mSnap = await tx.get(mRef);
    if (!mSnap.exists) throw notFound(`Mission ${missionId} not found`);

    const m = mSnap.data() as Record<string, any>;
    if (m.status !== 'completed') {
      throw conflict(`Mission status is ${m.status}, not completed`);
    }
    if (!m.artisanId) throw conflict('Mission has no assigned artisan');

    const gross      = Number(m.paidAmount ?? m.amount);
    const commission = Math.round(gross * serverEnv.PLATFORM_COMMISSION_RATE);
    const net        = gross - commission;

    const now    = Timestamp.now();
    const txDoc  = adminDb().collection('transactions').doc();
    const aRef   = adminDb().collection('users').doc(m.artisanId);

    tx.update(mRef, {
      status:        'released',
      releasedAt:    now,
      releasedBy:    admin.uid,
      releasedNet:   net,
      releasedGross: gross,
      commission,
      updatedAt:     now,
    });

    tx.set(txDoc, {
      kind:        'release',
      missionId,
      userId:      m.artisanId,
      amount:      net,
      gross,
      commission,
      note:        note ?? null,
      recordedBy:  admin.uid,
      createdAt:   now,
    });

    /* Credit artisan's payable balance */
    tx.set(aRef, {
      payableBalance: FieldValue.increment(net),
      updatedAt:      now,
    }, { merge: true });

    return { txId: txDoc.id, net, commission, gross };
  });

  await audit({
    actor:  admin.uid,
    action: 'safepay.release',
    target: missionId,
    meta:   { ...result },
  });

  return NextResponse.json({ ok: true, ...result });
});
