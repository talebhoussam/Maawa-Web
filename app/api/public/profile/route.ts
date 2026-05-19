/**
 * GET /api/public/profile?id={uid}
 *
 * Public unauthenticated endpoint that returns the safe public subset
 * of a user's profile. Used by /profile/{id} for guest viewers and by
 * follower-list rendering on any page.
 *
 * Why a server endpoint instead of relaxing firestore.rules on /users?
 * The user doc holds `phone` and `email`. Making those world-readable
 * would be a serious privacy regression. This route extracts the
 * public fields server-side and never exposes the rest.
 *
 * Cached at the edge for 60 seconds — profile names and trades don't
 * change minute-by-minute.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { handler, badRequest, notFound } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id || id.length < 1 || id.length > 80) throw badRequest('Missing or invalid id');

  const snap = await adminDb().collection('users').doc(id).get();
  if (!snap.exists) throw notFound('User not found');

  const d = snap.data() as Record<string, unknown>;

  /* Strict public allow-list. Anything not in here stays server-side. */
  const safe = {
    uid:           snap.id,
    displayName:   typeof d.displayName === 'string' ? d.displayName : null,
    role:          typeof d.role        === 'string' ? d.role        : null,
    trade:         typeof d.trade       === 'string' ? d.trade       : null,
    wilaya:        typeof d.wilaya      === 'string' ? d.wilaya      : null,
    bio:           typeof d.bio         === 'string' ? d.bio         : null,
    avatarUrl:     typeof d.avatarUrl   === 'string' ? d.avatarUrl   : null,
    verified:      d.verified === true,
    rating:        typeof d.rating         === 'number' ? d.rating         : null,
    missionsCount: typeof d.missionsCount  === 'number' ? d.missionsCount  : null,
    experience:    typeof d.experience     === 'number' ? d.experience     : null,
    available:     d.available !== false,
    reviewCount:   typeof d.reviewCount    === 'number' ? d.reviewCount    : null,
    premium:       d.premium === true,
  };

  const res = NextResponse.json(safe);
  res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res;
});
