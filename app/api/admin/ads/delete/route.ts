/**
 * POST /api/admin/ads/delete
 *
 * Soft-delete an ad by flipping active=false. Same rationale as
 * categories: historical references can still resolve their content.
 *
 * Body: { id: string }
 * Audit: `admin.ad.deactivate`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit, notFound,
} from '@/lib/api';

const Body = z.object({ id: z.string().min(1).max(60) }).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const ref = adminDb().collection('ads').doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound(`Ad ${body.id} not found`);

  await ref.set({ active: false, updatedAt: Timestamp.now() }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.ad.deactivate',
    target: body.id,
  });

  return NextResponse.json({ ok: true });
});
