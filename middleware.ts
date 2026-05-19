import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware — runs before every page render that matches the matcher.
 *
 * What it does (in order):
 *   1. Reads the `__session` cookie (set by /api/auth/session-login).
 *   2. For protected platform routes:
 *      - if no cookie → redirect to /login.
 *   3. For auth routes (/login, /register):
 *      - if cookie present → redirect to /feed (already logged in).
 *   4. For /admin/* (except /admin/login):
 *      - if no cookie → redirect to /admin/login.
 *      - admin role itself is verified inside the page's server component
 *        AND in the API routes; this layer just blocks anonymous access.
 *   5. For /seed/* :
 *      - blocked entirely unless ENABLE_SEED_ROUTES=true on the server.
 *
 * What it does NOT do:
 *   • Verify the cookie's signature. That requires the Firebase Admin SDK
 *     which can't run in the Edge Runtime. Pages and API routes that need
 *     a verified identity call `verifySessionCookie()` themselves. The
 *     middleware is a coarse pre-filter — sufficient for redirect UX,
 *     not sufficient as the only auth check.
 *
 * Cookie name `__session` is special: Firebase Hosting CDN strips most
 * cookies but preserves anything starting with `__session`. Using this
 * name is the convention even off Firebase Hosting.
 */

/* Phase 6: only routes that require *user identity* are protected.
   Browse-able pages (feed, reels, profiles, categories, explore,
   quote) are open to guests; interactive actions inside them call
   useRequireAuth() to trigger the ConnectOrCallModal. */
const PROTECTED_PLATFORM = [
  '/wallet', '/missions', '/dashboard',
  '/chat', '/notifications', '/settings',
  '/apply', '/saved',
  '/artisan',
];

const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

function pathMatches(pathname: string, list: string[]): boolean {
  return list.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* Block /seed routes entirely in production unless explicitly enabled. */
  if (pathname.startsWith('/seed')) {
    const seedEnabled = process.env.ENABLE_SEED_ROUTES === 'true';
    const isProd      = process.env.NODE_ENV === 'production';
    if (isProd && !seedEnabled) {
      return new NextResponse('Not Found', { status: 404 });
    }
    /* Even when enabled, seed routes still require auth. Fall through. */
  }

  const session   = request.cookies.get('__session')?.value;
  const hasSession = Boolean(session && session.length > 20);

  /* /admin/login is the one /admin/* path that's open to unauth users */
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    /* Role check happens inside the page (server-component or via API).
       We can't run firebase-admin in the Edge Runtime. */
    return NextResponse.next();
  }

  /* If they're authenticated and try to load the public auth pages,
     bounce them home — same UX as before. */
  if (hasSession && pathMatches(pathname, AUTH_ROUTES)) {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.redirect(url);
  }

  /* If they're not authenticated and trying to load protected platform
     routes, send them to login with `next` so we can redirect back after. */
  if (!hasSession && pathMatches(pathname, PROTECTED_PLATFORM)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /* Skip Next.js internals, the API (which does its own auth), and static
     assets. Everything else flows through. */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|otf)$).*)',
  ],
};
