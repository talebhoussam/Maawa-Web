'use client';

/**
 * Client-side FCM helpers.
 *
 * Three exported pieces:
 *   - `isPushSupported()` — returns true only when Notification API,
 *     ServiceWorker, and PushManager are all present. Safari iOS gets
 *     a fair shake (works in iOS 16.4+ as a PWA).
 *   - `enablePush()` — full opt-in flow: ask permission, register the
 *     SW, fetch the FCM token, POST it to /api/push/register-token.
 *     Returns the token string on success, null on bail.
 *   - `getPushStatus()` — reads current `Notification.permission`.
 *
 * Lazy-imports `firebase/messaging` so the bundle stays slim for
 * browsers that never opt in.
 */

import { publicEnv } from '@/lib/env';

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager'   in window
  );
}

export type PushStatus = 'unsupported' | 'unconfigured' | 'default' | 'granted' | 'denied';

export function getPushStatus(): PushStatus {
  if (!isPushSupported())                  return 'unsupported';
  if (!publicEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return 'unconfigured';
  return Notification.permission as 'default' | 'granted' | 'denied';
}

export async function enablePush(): Promise<string | null> {
  const status = getPushStatus();
  if (status === 'unsupported' || status === 'unconfigured') return null;
  if (status === 'denied') return null;

  /* Permission prompt — must be invoked from a user gesture. */
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;

  /* Register the static SW. We deliberately use a fixed path so
     the FCM SDK picks it up — don't rename. */
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (err) {
    console.warn('push: SW register failed', err);
    return null;
  }

  /* Wait until the SW is actually ready — FCM's getToken sometimes
     fails on first call otherwise. */
  await navigator.serviceWorker.ready;

  /* Lazy-load messaging only when the user opts in. */
  const [{ initializeApp, getApps }, { getMessaging, getToken, onMessage }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);

  const apps = getApps();
  const app = apps[0] ?? initializeApp({
    apiKey:            publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  const messaging = getMessaging(app);

  let token: string | null = null;
  try {
    token = await getToken(messaging, {
      vapidKey: publicEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      serviceWorkerRegistration: registration,
    });
  } catch (err) {
    console.warn('push: getToken failed', err);
    return null;
  }
  if (!token) return null;

  /* Foreground messages — fire a manual Notification when the tab is
     focused (FCM only auto-renders when the tab is hidden). */
  onMessage(messaging, (payload) => {
    if (Notification.permission !== 'granted') return;
    const title = payload.notification?.title || (payload.data?.title as string) || 'Maawa';
    const body  = payload.notification?.body  || (payload.data?.body  as string) || '';
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: (payload.data?.tag as string) || 'maawa-default',
    });
  });

  /* Persist server-side. */
  try {
    await fetch('/api/push/register-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        userAgent: navigator.userAgent.slice(0, 300),
      }),
    });
  } catch (err) {
    console.warn('push: token persist failed', err);
    /* Don't bail — push will still work in this session. */
  }

  return token;
}
