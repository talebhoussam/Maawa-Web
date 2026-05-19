/**
 * POST /api/safepay/confirm-payment
 *
 * Admin-only. Records that an office payment has been received for a
 * mission. Performs the state transition:
 *   pending_office → confirmed
 * inside a Firestore transaction so the mission state, the transaction
 * row, and the audit log are all written atomically.
 *
 * Body: {
 *   missionId: string,
 *   amount:    number (DZD, integer, must equal mission.amount unless override),
 *   method:    'cash' | 'ccp' | 'baridimob' | 'bank' | 'other',
 *   reference: string (optional; receipt no., CCP slip no., etc.),
 *   note:      string (optional; admin internal note),
 *   acceptDiscrepancy: boolean (required if amount !== mission.amount)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit,
  uidSchema, dzdAmountSchema, paymentMethodSchema,
  notFound, badRequest, conflict,
} from '@/lib/api';

const Body = z.object({
  missionId:         uidSchema,
  amount:            dzdAmountSchema,
  method:            paymentMethodSchema,
  reference:         z.string().min(1).max(80).optional(),
  note:              z.string().max(500).optional(),
  acceptDiscrepancy: z.boolean().optional().default(false),
});

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    const ref  = adminDb().collection('missions').doc(body.missionId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound(`Mission ${body.missionId} not found`);

    const m = snap.data() as Record<string, unknown>;
    if (m.status !== 'pending_office') {
      throw conflict(`Mission status is ${m.status}, not pending_office`);
    }

    const expected = Number(m.amount);
    if (!Number.isFinite(expected) || expected <= 0) {
      throw badRequest('Mission has no valid amount; reload mission first');
    }

    if (body.amount !== expected && !body.acceptDiscrepancy) {
      throw badRequest(
        `Amount mismatch: received ${body.amount}, expected ${expected}. ` +
        `Set acceptDiscrepancy=true to override.`,
      );
    }

    const txDoc = adminDb().collection('transactions').doc();
    const now   = Timestamp.now();

    tx.update(ref, {
      status:           'confirmed',
      paidAt:           now,
      paidVia:          body.method,
      paidReference:    body.reference ?? null,
      paidAmount:       body.amount,
      lastUpdatedBy:    admin.uid,
      updatedAt:        now,
    });

    tx.set(txDoc, {
      kind:        'office_payment',
      missionId:   body.missionId,
      userId:      m.clientId ?? null,
      amount:      body.amount,
      expected,
      method:      body.method,
      reference:   body.reference ?? null,
      note:        body.note ?? null,
      discrepancy: body.amount !== expected,
      recordedBy:  admin.uid,
      createdAt:   now,
    });

    return { txId: txDoc.id, expected };
  });

  await audit({
    actor:  admin.uid,
    action: 'safepay.confirm_payment',
    target: body.missionId,
    meta: {
      amount:      body.amount,
      expected:    result.expected,
      method:      body.method,
      reference:   body.reference,
      discrepancy: body.amount !== result.expected,
      txId:        result.txId,
    },
  });

  return NextResponse.json({ ok: true, txId: result.txId });
});
