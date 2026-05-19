/**
 * POST /api/auth/session-login
 *
 * Body: { idToken: string }
 *
 * Exchanges a Firebase ID token for a long-lived session cookie. The
 * client sends its ID token; we verify it via the Admin SDK and then
 * mint a session cookie which the browser stores HttpOnly+Secure.
 *
 * Why? The ID token expires every hour and is in JS-readable storage
 * (IndexedDB). The session cookie lasts up to 14 days, is HttpOnly so
 * XSS can't read it, and is sent automatically with every request — so
 * the middleware can gate routes and API routes can verify identity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { handler, parseBody, badRequest, unauthorized } from '@/lib/api';
import { isProd } from '@/lib/env';

const Body = z.object({
  idToken: z.string().min(20),
});

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;  /* 14 days */

export const POST = handler(async (req: NextRequest) => {
  const { idToken } = await parseBody(req, Body);

  /* Verify the ID token first — also auto-revokes any stolen tokens. */
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken, /* checkRevoked */ true);
  } catch {
    throw unauthorized('Invalid or expired ID token');
  }

  /* Refuse to mint a session cookie for tokens older than 5 minutes —
     this is the recommended Firebase pattern to defeat replay of leaked
     ID tokens. */
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
    throw unauthorized('Token too old; reauthenticate');
  }

  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
  } catch {
    throw badRequest('Failed to mint session cookie');
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('__session', sessionCookie, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_DURATION_MS / 1000,
  });
  return res;
});
