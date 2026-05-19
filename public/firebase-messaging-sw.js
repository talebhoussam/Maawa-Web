/* eslint-disable */
/**
 * Firebase Cloud Messaging service worker.
 *
 * Browsers serve this file from `/firebase-messaging-sw.js` at the
 * site root. The FCM JS SDK looks for it at that exact path; don't
 * rename or move.
 *
 * Runtime config is injected at /api/push/config (a public route)
 * because static service workers can't read `process.env`. The
 * config endpoint returns Firebase Web Push config + the VAPID key
 * already validated against env.ts.
 *
 * If config fetch fails (VAPID unset → operator hasn't configured
 * push yet) we no-op gracefully — the page still works, the user
 * just doesn't receive push notifications.
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

(async () => {
  try {
    const res = await fetch('/api/push/config');
    if (!res.ok) return;
    const cfg = await res.json();
    if (!cfg.firebaseConfig || !cfg.firebaseConfig.apiKey) return;

    firebase.initializeApp(cfg.firebaseConfig);
    const messaging = firebase.messaging();

    /* Background message handler — fired when the tab is not focused.
       Foreground messages are handled in lib/push.ts via onMessage. */
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Maawa';
      const body  = payload.notification?.body  || payload.data?.body  || '';
      const url   = payload.fcmOptions?.link    || payload.data?.url   || '/feed';

      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url },
        /* Tag dedupes back-to-back notifications with the same id. */
        tag: payload.data?.tag || 'maawa-default',
      });
    });
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.warn('[fcm-sw] init failed (push disabled):', err);
  }
})();

/* Click-to-open: focus an existing tab if open, else open a new one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/feed';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        try { await w.navigate(url); } catch { /* same-origin sometimes refused */ }
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
