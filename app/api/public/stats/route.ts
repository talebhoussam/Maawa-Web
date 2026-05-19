/**
 * GET /api/public/stats
 *
 * Public, unauthenticated endpoint that returns platform-wide counts
 * used by the landing page. Uses the Admin SDK (bypasses Firestore
 * rules) so we can show real counts without exposing the `users`
 * collection to anonymous reads.
 *
 * Cached at the edge for 5 minutes — the landing page doesn't need
 * second-by-second precision and the count queries cost real money.
 *
 * Response shape:
 *   { artisans: number, clients: number, threshold: number }
 *
 * The landing page checks `count >= threshold` (10) before showing
 * the number; below that, qualitative copy is shown instead so the
 * platform doesn't look empty.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { handler } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 300; /* 5 minutes — for Vercel ISR */

const THRESHOLD = 10;

export const GET = handler(async () => {
  const usersRef = adminDb().collection('users');

  /* Count verified artisans and total clients in parallel. Admin SDK
     `.count()` translates to a Firestore COUNT aggregation, billed at
     1 document read per 1000 matched documents. */
  const [artisansSnap, clientsSnap] = await Promise.all([
    usersRef.where('role', '==', 'artisan').where('verified', '==', true).count().get(),
    usersRef.where('role', '==', 'client').count().get(),
  ]);

  const artisans = artisansSnap.data().count;
  const clients  = clientsSnap.data().count;

  const res = NextResponse.json({ artisans, clients, threshold: THRESHOLD });
  /* CDN cache (Vercel / Cloud CDN) — `s-maxage` shared cache, no client cache. */
  res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res;
});
