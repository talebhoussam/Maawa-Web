/**
 * Next.js instrumentation hook.
 *
 * Runs once at server boot. Used to register Sentry for the right
 * runtime — Sentry's @sentry/nextjs documents this as the recommended
 * setup for Next 13+.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
