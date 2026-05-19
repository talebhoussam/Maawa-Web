/**
 * POST /api/auth/session-logout
 *
 * Clears the __session cookie and (best-effort) revokes the user's
 * refresh tokens so even leaked ID tokens stop working.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { handler } from '@/lib/api';
import { logger } from '@/lib/logger';

export const POST = handler(async (req: NextRequest) => {
  const session = req.cookies.get('__session')?.value;

  if (session) {
    try {
      const decoded = await adminAuth().verifySessionCookie(session, false);
      await adminAuth().revokeRefreshTokens(decoded.uid);
    } catch (err) {
      /* Failing to revoke isn't fatal — user is logging out anyway,
         the cookie clear below is what matters. Log for diagnostic. */
      logger.warn({ err }, '[session-logout] revoke failed');
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('__session', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  });
  return res;
});
