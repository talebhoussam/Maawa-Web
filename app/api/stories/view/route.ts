/**
 * POST /api/stories/view
 *
 * Increment a story's view counter. Idempotent per signed-in viewer:
 * we mark the viewer in /stories/{id}/viewers/{viewerUid} and skip
 * the increment when the marker already exists. Guests don't call
 * this — view rule for guests is "free to watch, doesn't count".
 *
 * Body: { storyId: string }
 *
 * We do this inside a Firestore transaction so two concurrent calls
 * from the same viewer can't double-increment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { handler, parseBody, requireAuth, notFound } from '@/lib/api';

const Body = z.object({
  storyId: z.string().min(1).max(80),
}).strict();

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await parseBody(req, Body);

  const counted = await adminDb().runTransaction(async (tx) => {
    const storyRef  = adminDb().collection('stories').doc(body.storyId);
    const viewerRef = storyRef.collection('viewers').doc(user.uid);

    const [storySnap, viewerSnap] = await Promise.all([
      tx.get(storyRef),
      tx.get(viewerRef),
    ]);

    if (!storySnap.exists) throw notFound(`Story ${body.storyId} not found`);
    if (viewerSnap.exists) return false; /* already counted */

    /* Owners viewing their own story shouldn't pad the counter — and
       we still mark them as a viewer so the UI can tell whether the
       owner has "seen it". */
    const storyData = storySnap.data() as Record<string, unknown>;
    const isOwner = storyData.userId === user.uid;

    tx.set(viewerRef, { viewedAt: Timestamp.now() });
    if (!isOwner) {
      tx.update(storyRef, { views: FieldValue.increment(1) });
    }
    return !isOwner;
  });

  return NextResponse.json({ ok: true, counted });
});
