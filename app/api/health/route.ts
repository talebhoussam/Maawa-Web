/**
 * GET /api/health
 *
 * Readiness/liveness probe. Returns 200 if the process is up and the
 * Admin SDK can talk to Firebase, 503 otherwise.
 *
 * Hosting platforms (Vercel, Cloud Run, K8s) point their probes here.
 * Don't add expensive checks — this runs on every probe interval.
 */

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { handler } from '@/lib/api';
import { twilioConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const checks: Record<string, 'ok' | 'fail' | 'skipped'> = {
    process: 'ok',
    firebase_admin: 'ok',
    twilio: twilioConfigured ? 'ok' : 'skipped',
  };

  /* Tiny probe: make sure the Admin SDK can sign a custom token. This
     forces the cert to load and the JWT signer to initialize without
     making a network call. */
  try {
    await adminAuth().createCustomToken('healthcheck-no-such-uid', {});
  } catch {
    checks.firebase_admin = 'fail';
  }

  const allOk = !Object.values(checks).includes('fail');
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
});
