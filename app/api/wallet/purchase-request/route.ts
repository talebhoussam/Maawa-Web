/**
 * POST /api/wallet/purchase-request
 *
 * A user submits a "demande de recharge" — they're asking to convert
 * DZD (paid via CCP / Baridimob / cash at the office) into Maawa Coins.
 * No money moves on this call: the admin reviews and credits coins
 * via /api/admin/wallet/approve-request.
 *
 * Body: {
 *   amountMC:      integer 100..10000
 *   paymentMethod: 'ccp' | 'baridimob' | 'cash_office'
 *   reference:     optional string (CCP slip no., Baridimob ref, etc.)
 *   proofPath:     optional Storage path "coin_proofs/{uid}/{filename}"
 * }
 *
 * Response: { requestId, amountDZD, instructions: { ccp?, baridimob?, officeAddress? } }
 *
 * Side effects:
 *   - Creates a `coin_purchase_requests` document with status='pending'.
 *   - Audit-logs `wallet.purchase_request_created`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { publicEnv } from '@/lib/env';
import {
  handler, parseBody, requireAuth, audit, badRequest,
} from '@/lib/api';

const Body = z.object({
  amountMC:      z.number().int().min(100).max(10000),
  paymentMethod: z.enum(['ccp', 'baridimob', 'cash_office']),
  reference:     z.string().min(1).max(80).optional(),
  /* Storage path of the uploaded proof — already written client-side by
     the Firebase Storage SDK. We re-verify the file exists + lives under
     the caller's folder; we don't accept arbitrary URLs. */
  proofPath:     z.string().min(1).max(300).optional(),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  /* If the user provided a proof path, validate ownership + existence.
     The path MUST be under /coin_proofs/{their-own-uid}/, otherwise
     it's either a bug or an exfiltration attempt. */
  if (body.proofPath) {
    const expectedPrefix = `coin_proofs/${user.uid}/`;
    if (!body.proofPath.startsWith(expectedPrefix)) {
      throw badRequest(`proofPath must start with ${expectedPrefix}`);
    }
    try {
      const file = adminStorage().bucket().file(body.proofPath);
      const [exists] = await file.exists();
      if (!exists) throw badRequest('Proof file not found in Storage');
    } catch (err) {
      if (err && typeof err === 'object' && 'err' in err) throw err; /* re-throw ApiException */
      throw badRequest('Could not verify proof upload');
    }
  }

  const rate = publicEnv.NEXT_PUBLIC_MC_RATE_DZD;
  const amountDZD = body.amountMC * rate;

  const docRef = adminDb().collection('coin_purchase_requests').doc();
  const now = Timestamp.now();

  await docRef.set({
    userId:        user.uid,
    amountMC:      body.amountMC,
    amountDZD,
    paymentMethod: body.paymentMethod,
    proofUrl:      body.proofPath ?? null,
    reference:     body.reference ?? null,
    status:        'pending',
    createdAt:     now,
    reviewedAt:    null,
    reviewedBy:    null,
    reviewNote:    null,
  });

  await audit({
    actor:  user.uid,
    action: 'wallet.purchase_request_created',
    target: docRef.id,
    meta: {
      amountMC:      body.amountMC,
      amountDZD,
      paymentMethod: body.paymentMethod,
      hasProof:      Boolean(body.proofPath),
    },
  });

  /* Return only the instructions for the chosen payment method —
     no point sending the others. Blank env values fall through to
     undefined; the client handles that case. */
  const instructions: { ccp?: string; baridimob?: string; officeAddress?: string } = {};
  if (body.paymentMethod === 'ccp' && publicEnv.NEXT_PUBLIC_CCP_NUMBER) {
    instructions.ccp = publicEnv.NEXT_PUBLIC_CCP_NUMBER;
  } else if (body.paymentMethod === 'baridimob' && publicEnv.NEXT_PUBLIC_BARIDIMOB_NUMBER) {
    instructions.baridimob = publicEnv.NEXT_PUBLIC_BARIDIMOB_NUMBER;
  } else if (body.paymentMethod === 'cash_office' && publicEnv.NEXT_PUBLIC_OFFICE_ADDRESS) {
    instructions.officeAddress = publicEnv.NEXT_PUBLIC_OFFICE_ADDRESS;
  }

  return NextResponse.json({
    ok:        true,
    requestId: docRef.id,
    amountDZD,
    instructions,
  });
});
