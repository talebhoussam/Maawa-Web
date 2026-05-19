/**
 * GET /api/push/config
 *
 * Returns the Firebase Web config + VAPID key for the service worker.
 * Public — every field here is already exposed in NEXT_PUBLIC_* env
 * vars on the client bundle. The point of the route is that service
 * workers can't read process.env directly, so they fetch this.
 *
 * If VAPID isn't set we still return a valid config — the service
 * worker falls back to no-op (no push) which is the desired behavior
 * pre-launch when the operator hasn't generated keys yet.
 */

import { NextResponse } from 'next/server';
import { publicEnv } from '@/lib/env';

export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json({
    firebaseConfig: {
      apiKey:            publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain:        publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId:         publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:     publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId:             publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    vapidKey: publicEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? null,
  }, {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
