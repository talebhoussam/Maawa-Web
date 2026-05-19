/**
 * POST /api/admin/missions/assign
 *
 * Admin. Assigns an artisan to an unassigned mission. Or reassigns,
 * which logs both the previous artisan and the new one.
 *
 * State: dispatch/pending → confirmed (with artisanId set)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAdmin, audit, uidSchema, notFound, conflict } from '@/lib/api';

const Body = z.object({
  missionId: uidSchema,
  artisanId: uidSchema,
  note:      z.string().max(500).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const { missionId, artisanId, note } = await parseBody(req, Body);

  const result = await adminDb().runTransaction(async (tx) => {
    const mRef = adminDb().collection('missions').doc(missionId);
    const mSnap = await tx.get(mRef);
    if (!mSnap.exists) throw notFound(`Mission ${missionId} not found`);
    const m = mSnap.data() as Record<string, any>;

    /* Verify the artisan exists, is verified, and not banned. */
    const aRef = adminDb().collection('users').doc(artisanId);
    const aSnap = await tx.get(aRef);
    if (!aSnap.exists) throw notFound(`Artisan ${artisanId} not found`);
    const a = aSnap.data() as Record<string, any>;
    if (a.role !== 'artisan')   throw conflict(`User is not an artisan (role=${a.role})`);
    if (!a.verified)            throw conflict('Artisan is not verified');
    if (a.banned)               throw conflict('Artisan is banned');

    const previous = m.artisanId ?? null;
    tx.update(mRef, {
      artisanId,
      previousArtisanId: previous,
      assignedBy:        admin.uid,
      assignedAt:        Timestamp.now(),
      updatedAt:         Timestamp.now(),
    });

    return { previous };
  });

  await audit({
    actor:  admin.uid,
    action: 'admin.mission.assign',
    target: missionId,
    meta:   { artisanId, previousArtisanId: result.previous, note },
  });

  return NextResponse.json({ ok: true });
});
