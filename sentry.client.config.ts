/**
 * Sentry — client-side initialization.
 *
 * Loaded by Next.js automatically when the package is installed.
 * The DSN comes from NEXT_PUBLIC_SENTRY_DSN; if it's unset we no-op so
 * dev environments don't accidentally ship telemetry.
 *
 * Phase 7 perf: deferred past first paint via `requestIdleCallback`
 * (falling back to a 1500ms setTimeout on Safari, which doesn't have
 * the API yet). Sentry's replay + tracing integrations are heavy
 * enough that initialising them synchronously hurts LCP. We accept
 * the tiny window where the very first error after page load can be
 * missed — a perfectly fair tradeoff for a marketplace where users
 * are most often browsing, not crashing.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    /* Capture 100% of error events; sample 10% of performance traces.
       Tune lower in production if traffic gets heavy. */
    tracesSampleRate: 0.1,
    /* Capture browser session replays only when an error happens —
       not every session. Avoids GDPR-sensitive recording. */
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NODE_ENV,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    /* Drop events that come from user-cancelled fetches or browser
       extensions — they pollute the dashboard. */
    ignoreErrors: [
      'AbortError',
      'NetworkError when attempting to fetch resource',
      'top.GLOBALS',
    ],
  });
}

if (dsn && typeof window !== 'undefined') {
  /* requestIdleCallback runs after first paint; safari fallback is
     a generous 1.5s timeout — still after first paint on any device. */
  type IdleAPI = (cb: () => void, opts?: { timeout: number }) => number;
  const ric = (window as unknown as { requestIdleCallback?: IdleAPI }).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(initSentry, { timeout: 2500 });
  } else {
    setTimeout(initSentry, 1500);
  }
}
