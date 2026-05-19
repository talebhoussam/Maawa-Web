/**
 * POST /api/admin/wallet/reject-request
 *
 * Admin rejects a pending coin-purchase request. No money moves — we
 * just flip status to 'rejected' and capture the reason for the audit
 * trail. The user will see the reason next to their request in
 * /wallet > "Mes demandes".
 *
 * Body: { requestId: string, reason: string (min 3 chars) }
 *
 * Audit: `admin.coin.reject` with meta={requestId,userId,reason}.
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
  requestId: z.string().min(1).max(80),
  reason:    z.string().min(3).max(500),
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

    const now = Timestamp.now();
    tx.update(reqRef, {
      status:     'rejected',
      reviewedAt: now,
      reviewedBy: admin.uid,
      reviewNote: body.reason,
    });

    return { userId: String(r.userId ?? '') };
  });

  await audit({
    actor:  admin.uid,
    action: 'admin.coin.reject',
    target: body.requestId,
    meta: {
      userId: result.userId,
      reason: body.reason,
    },
  });

  return NextResponse.json({ ok: true });
});
