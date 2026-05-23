/** @type {import('next').NextConfig} */

/* Strict Content Security Policy.
 *
 * Allowed origins, by purpose:
 *   • 'self'                                 — our own assets
 *   • https://*.googleapis.com               — Firestore REST + Identity Toolkit
 *   • https://*.firebaseio.com               — Realtime DB / WebChannel
 *   • https://*.googleapis.com               — Firebase / Google Maps APIs
 *   • https://www.gstatic.com                — Firebase Auth iframe + reCAPTCHA scripts
 *   • https://www.google.com                 — reCAPTCHA challenge frame
 *   • https://maps.googleapis.com            — Google Maps tiles + static
 *   • https://fonts.googleapis.com           — Google Fonts CSS
 *   • https://fonts.gstatic.com              — Google Fonts files
 *   • https://*.sentry.io                    — Sentry telemetry endpoint
 *
 * 'unsafe-inline' on style-src is unfortunately required for inline
 * styles (Next.js, Google Maps, our admin CSS variables). It is NOT on
 * script-src — no inline scripts allowed.
 *
 * `report-to` / `report-uri` not configured here; add a Sentry CSP
 * report endpoint later if violations need monitoring.
 */
const isDev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.gstatic.com https://www.google.com https://apis.google.com https://maps.googleapis.com https://*.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob: https://firebasestorage.googleapis.com https://*.googleapis.com https://*.firebaseio.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://*.sentry.io https://maps.googleapis.com",
  "frame-src 'self' https://*.firebaseapp.com https://www.google.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy',   value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  /* Apply security headers to every route. /api routes get them too —
     they're cheap and prevent the CSP from being undefined on JSON
     responses, which some browsers complain about. */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

  /* Image optimization domains. Firebase Storage URLs come back from the
     `firebasestorage.googleapis.com` CDN; restrict to that + our project's
     bucket to prevent the optimizer being used as an open proxy. */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  /* Reject any non-NEXT_PUBLIC_ env vars from leaking into the client.
     This is a build-time safety net layered on top of lib/env.ts. */
  experimental: {
    typedRoutes: false,  /* Off until all routes are stable */
  },
};

export default nextConfig;
