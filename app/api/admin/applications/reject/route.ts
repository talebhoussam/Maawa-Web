/**
 * POST /api/admin/applications/reject
 *
 * Admin. Rejects an artisan application with a reason. Does not
 * disable the user account — they can re-apply.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, uidSchema, notFound, conflict } from '@/lib/api';

const Body = z.object({
  applicationId: uidSchema,
  reason:        z.enum(['nin_unclear', 'nin_invalid', 'incomplete_profile', 'other']),
  note:          z.string().min(3).max(500),
});

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const { applicationId, reason, note } = await parseBody(req, Body);

  const aRef  = adminDb().collection('applications').doc(applicationId);
  const aSnap = await aRef.get();
  if (!aSnap.exists) throw notFound(`Application ${applicationId} not found`);
  const a = aSnap.data() as Record<string, any>;
  if (a.status === 'rejected') throw conflict('Already rejected');

  await aRef.update({
    status:     'rejected',
    reviewedBy: admin.uid,
    reviewedAt: Timestamp.now(),
    rejectReason: reason,
    rejectNote: note,
  });

  await audit({
    actor:  admin.uid,
    action: 'admin.application.reject',
    target: applicationId,
    meta:   { reason, note, userId: a.userId },
  });

  return NextResponse.json({ ok: true });
});
