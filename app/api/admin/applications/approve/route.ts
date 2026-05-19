/**
 * POST /api/admin/applications/approve
 *
 * Admin. Approves an artisan application:
 *   - Sets application.status = 'approved'
 *   - Sets user.role = 'artisan' + user.verified = true
 *   - Sets user.verifiedAt = now
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, uidSchema, notFound, conflict } from '@/lib/api';

const Body = z.object({
  applicationId: uidSchema,
  note:          z.string().max(500).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const { applicationId, note } = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    const aRef  = adminDb().collection('applications').doc(applicationId);
    const aSnap = await tx.get(aRef);
    if (!aSnap.exists) throw notFound(`Application ${applicationId} not found`);
    const a = aSnap.data() as Record<string, any>;
    if (a.status === 'approved') throw conflict('Application already approved');
    if (!a.userId)               throw conflict('Application has no userId');

    const uRef = adminDb().collection('users').doc(a.userId);
    const now  = Timestamp.now();

    tx.update(aRef, {
      status:      'approved',
      reviewedBy:  admin.uid,
      reviewedAt:  now,
      reviewNote:  note ?? null,
    });
    tx.set(uRef, {
      role:        'artisan',
      verified:    true,
      verifiedAt:  now,
      trade:       a.trade ?? null,
      updatedAt:   now,
    }, { merge: true });

    return { userId: a.userId };
  });

  await audit({
    actor:  admin.uid,
    action: 'admin.application.approve',
    target: applicationId,
    meta:   { userId: result.userId },
  });

  return NextResponse.json({ ok: true, userId: result.userId });
});
