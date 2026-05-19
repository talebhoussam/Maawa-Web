/**
 * Firebase client SDK initialization.
 *
 * This file is imported by browser code only. Server code uses
 * `lib/firebase-admin.ts` which has elevated privileges.
 *
 * The lazy `getApps().length === 0` guard prevents double-initialization
 * during HMR and during Next.js's bundling of client + server modules.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { publicEnv } from './env';

const firebaseConfig = {
  apiKey:            publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     publicEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth:    Auth            = getAuth(app);
export const db:      Firestore       = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

/* Analytics is browser-only and async-loaded. Wrap in a promise so
   consumers can `await analyticsReady` if they need it; otherwise
   tree-shake friendly. */
export const analyticsReady: Promise<Analytics | null> =
  typeof window !== 'undefined'
    ? isSupported().then((yes) => (yes ? getAnalytics(app) : null))
    : Promise.resolve(null);

export default app;
