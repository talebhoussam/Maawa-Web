/**
 * POST /api/admin/wallet/reject-payout
 *
 * Admin rejects a payout request with a mandatory reason. No money
 * movement — the artisan keeps their full `payableBalance`.
 *
 * Body: { requestId: string, reason: string (≥3 chars, ≤500) }
 * Audit: `admin.payout.rejected`.
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

  const reqRef = adminDb().collection('payout_requests').doc(body.requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw notFound(`Request ${body.requestId} not found`);
  const reqData = reqSnap.data() as Record<string, unknown>;
  if (reqData.status !== 'pending') {
    throw conflict(`Request is ${reqData.status}, cannot reject`);
  }

  await reqRef.set({
    status:     'rejected',
    reviewedBy: admin.uid,
    reviewedAt: Timestamp.now(),
    reviewNote: body.reason,
  }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.payout.rejected',
    target: body.requestId,
    meta:   { reason: body.reason },
  });

  return NextResponse.json({ ok: true });
});
