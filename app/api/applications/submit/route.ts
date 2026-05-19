/**
 * POST /api/applications/submit
 *
 * User submits an application to become an artisan. Creates an
 * `applications` doc in 'pending' status. Admin reviews via
 * /api/admin/applications/approve|reject.
 *
 * Body: { trade, experience, ninNumber, documents }
 *
 * NIN documents are uploaded to Storage at /applications/{userId}/* by
 * the client BEFORE calling this endpoint; this endpoint validates the
 * upload manifest and creates the application record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, conflict, badRequest } from '@/lib/api';

const Body = z.object({
  trade:      z.string().min(2).max(80),
  experience: z.number().int().min(0).max(60),
  ninNumber:  z.string().regex(/^\d{18}$/, 'NIN must be exactly 18 digits'),
  bio:        z.string().max(500).optional(),
  /* Names of files the user uploaded to /applications/{uid}/ */
  documents:  z.array(z.string().min(1).max(200)).min(2).max(5),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  /* Reject if there's already a pending or approved application. */
  const existingQuery = await adminDb()
    .collection('applications')
    .where('userId', '==', user.uid)
    .where('status', 'in', ['pending', 'approved'])
    .limit(1)
    .get();
  if (!existingQuery.empty) {
    throw conflict('You already have an active application');
  }

  /* Verify the documents the user claims to have uploaded actually exist
     in Storage — defends against an attacker submitting bogus filenames. */
  const bucket = adminStorage().bucket();
  for (const fname of body.documents) {
    const file = bucket.file(`applications/${user.uid}/${fname}`);
    const [exists] = await file.exists();
    if (!exists) throw badRequest(`Missing uploaded document: ${fname}`);
  }

  const ref = adminDb().collection('applications').doc();
  const now = Timestamp.now();

  await ref.set({
    userId:     user.uid,
    trade:      body.trade,
    experience: body.experience,
    ninNumber:  body.ninNumber,
    bio:        body.bio ?? null,
    documents:  body.documents,
    status:     'pending',
    createdAt:  now,
    updatedAt:  now,
  });

  return NextResponse.json({ ok: true, applicationId: ref.id });
});
