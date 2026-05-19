/**
 * Sentry — server-side initialization (Node runtime).
 *
 * Captures errors thrown in API routes, Server Components, and Server
 * Actions. PII redaction is handled at the logger layer; Sentry sees
 * only the error stacks.
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    /* Don't auto-capture request bodies — they may contain PII. */
    sendDefaultPii: false,
  });
}
