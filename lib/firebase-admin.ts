/**
 * Firebase Admin SDK initialization (server-only).
 *
 * Imported by API routes. Uses the service account credentials from env.
 *
 * IMPORTANT: this file must not be imported by client components. The
 * `import 'server-only'` directive throws a build error if it ever is.
 */

import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, type Storage as AdminStorage } from 'firebase-admin/storage';
import { serverEnv } from './env';

let app: App | undefined;

function getOrInitApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }
  app = initializeApp({
    credential: cert({
      projectId:   serverEnv.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: serverEnv.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:  serverEnv.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
    /* Match the client storage bucket so server-issued signed URLs
       resolve to the same files. */
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  return app;
}

/* Lazy getters — the Admin SDK is heavy and we only want it instantiated
   the first time an API route actually needs it. */
export const adminAuth:      () => AdminAuth      = () => getAdminAuth(getOrInitApp());
export const adminDb:        () => AdminFirestore = () => getAdminFirestore(getOrInitApp());
export const adminStorage:   () => AdminStorage   = () => getAdminStorage(getOrInitApp());
