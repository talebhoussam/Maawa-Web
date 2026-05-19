/**
 * POST /api/admin/categories/delete
 *
 * Categories are referenced by feed posts, applications, and quotes —
 * a hard delete would orphan those. We soft-delete by flipping
 * `active=false`. The platform UI filters on `active===true` for
 * dropdowns, so deactivated categories disappear from selection but
 * stay readable for historical data.
 *
 * Body: { id: string }
 * Audit: `admin.category.deactivate`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import {
  handler, parseBody, requireAdmin, audit, notFound,
} from '@/lib/api';

const Body = z.object({
  id: z.string().min(1).max(40),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body  = await parseBody(req, Body);

  const ref = adminDb().collection('categories').doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound(`Category ${body.id} not found`);

  await ref.set({ active: false, updatedAt: Timestamp.now() }, { merge: true });

  await audit({
    actor:  admin.uid,
    action: 'admin.category.deactivate',
    target: body.id,
  });

  return NextResponse.json({ ok: true });
});
