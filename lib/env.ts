/**
 * Environment variable validation.
 *
 * Two-tier validation:
 *   • CLIENT-side: only NEXT_PUBLIC_* vars. Imported by browser code.
 *   • SERVER-side: full schema. Imported by API routes and middleware.
 *
 * Validation runs at module load time. If a required var is missing or
 * malformed, the process exits with a clear error rather than crashing
 * later with a confusing stack trace.
 *
 * In Next.js the SAME module is bundled for the browser when imported by
 * a client component, so we MUST guard the server-only schema behind a
 * `typeof window === 'undefined'` check — otherwise the build inlines
 * server secrets into the client bundle. The pattern below splits the
 * schemas so client code can only ever access publicEnv.
 */

import { z } from 'zod';

/* ─── Client-safe env (NEXT_PUBLIC_*) ────────────────────────────────── */

const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY:             z.string().min(20),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:         z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:          z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:      z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID:              z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:      z.string().optional(),
  /* FCM web push — paste the VAPID public key from
     Firebase Console → Project settings → Cloud Messaging → Web Push
     certificates. When unset, the push opt-in UI is hidden and the
     service worker registers but never asks for permission. */
  NEXT_PUBLIC_FIREBASE_VAPID_KEY:           z.string().min(20).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_KEY:              z.string().min(20).optional(),
  NEXT_PUBLIC_SENTRY_DSN:                   z.string().url().optional(),
  NEXT_PUBLIC_APP_URL:                      z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_SUPPORT_PHONE:                z.string().regex(/^\+\d{6,15}$/).default('+213233000000'),
  NEXT_PUBLIC_MC_RATE_DZD:                  z.coerce.number().int().positive().default(50),
  /* Coin-purchase payment instructions — displayed to the user after
     they submit a recharge request. All optional: a blank value means
     that payment method's instructions are hidden in the UI. */
  NEXT_PUBLIC_CCP_NUMBER:                   z.string().max(60).optional(),
  NEXT_PUBLIC_BARIDIMOB_NUMBER:             z.string().max(60).optional(),
  NEXT_PUBLIC_OFFICE_ADDRESS:               z.string().max(200).optional(),
});

/* Reading process.env keys explicitly is required for Next.js to inline
   them into the client bundle. A dynamic process.env[k] won't be replaced. */
const rawClient = {
  NEXT_PUBLIC_FIREBASE_API_KEY:             process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:         process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID:              process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  NEXT_PUBLIC_FIREBASE_VAPID_KEY:           process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_KEY:              process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
  NEXT_PUBLIC_SENTRY_DSN:                   process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_APP_URL:                      process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPPORT_PHONE:                process.env.NEXT_PUBLIC_SUPPORT_PHONE,
  NEXT_PUBLIC_MC_RATE_DZD:                  process.env.NEXT_PUBLIC_MC_RATE_DZD,
  NEXT_PUBLIC_CCP_NUMBER:                   process.env.NEXT_PUBLIC_CCP_NUMBER,
  NEXT_PUBLIC_BARIDIMOB_NUMBER:             process.env.NEXT_PUBLIC_BARIDIMOB_NUMBER,
  NEXT_PUBLIC_OFFICE_ADDRESS:               process.env.NEXT_PUBLIC_OFFICE_ADDRESS,
};

const clientParsed = clientEnvSchema.safeParse(rawClient);
if (!clientParsed.success) {
  /* eslint-disable no-console */
  console.error('❌ Invalid client environment variables:');
  console.error(clientParsed.error.flatten().fieldErrors);
  /* eslint-enable no-console */
  throw new Error('Invalid client env. See errors above.');
}

export const publicEnv = clientParsed.data;

/* ─── Server-only env ────────────────────────────────────────────────── */

const serverEnvSchema = z.object({
  /* Firebase Admin SDK */
  FIREBASE_ADMIN_PROJECT_ID:   z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY:  z.string().min(100),

  /* Twilio Verify (SMS OTP) */
  TWILIO_ACCOUNT_SID:        z.string().regex(/^AC[0-9a-f]{32}$/i, 'Must look like AC...').optional(),
  TWILIO_AUTH_TOKEN:         z.string().min(20).optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().regex(/^VA[0-9a-f]{32}$/i, 'Must look like VA...').optional(),

  /* Auth signing (NextAuth-compatible secret length) */
  NEXTAUTH_SECRET: z.string().min(32, 'Must be at least 32 chars; use `openssl rand -base64 32`'),
  NEXTAUTH_URL:    z.string().url().optional(),

  /* Sentry */
  SENTRY_DSN: z.string().url().optional(),

  /* Feature flags */
  ENABLE_SEED_ROUTES: z.enum(['true', 'false']).default('false'),
  ENABLE_DEBUG_LOGS:  z.enum(['true', 'false']).default('false'),

  /* Admin bootstrap */
  BOOTSTRAP_ADMIN_UIDS: z.string().optional(),

  /* Pricing */
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.10),

  /* Runtime */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/* The server schema is only validated on the server. On the client we
   short-circuit to a Proxy that throws if anything tries to read it. */
function buildServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    return new Proxy({} as ServerEnv, {
      get(_, prop) {
        throw new Error(
          `serverEnv.${String(prop)} accessed in browser code. ` +
          `Server-only env vars must not be imported into client components.`,
        );
      },
    });
  }

  /* Unescape the literal `\n` in the private key (env files store it
     escaped because real newlines in env values break parsing). */
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
  const unescapedKey = rawKey.replace(/\\n/g, '\n');

  const raw = {
    ...process.env,
    FIREBASE_ADMIN_PRIVATE_KEY: unescapedKey,
  };

  const parsed = serverEnvSchema.safeParse(raw);
  if (!parsed.success) {
    /* eslint-disable no-console */
    console.error('❌ Invalid server environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    /* eslint-enable no-console */
    throw new Error('Invalid server env. See errors above.');
  }
  return parsed.data;
}

export const serverEnv = buildServerEnv();

export const isProd = typeof window === 'undefined' ? serverEnv.NODE_ENV === 'production' : process.env.NODE_ENV === 'production';
export const isDev  = typeof window === 'undefined' ? serverEnv.NODE_ENV === 'development' : process.env.NODE_ENV === 'development';
export const isTest = typeof window === 'undefined' ? serverEnv.NODE_ENV === 'test' : process.env.NODE_ENV === 'test';

export const seedEnabled  = typeof window === 'undefined' ? (serverEnv.ENABLE_SEED_ROUTES === 'true' && !isProd) : false;
export const debugLogging = typeof window === 'undefined' ? (serverEnv.ENABLE_DEBUG_LOGS  === 'true') : false;

export const twilioConfigured = typeof window === 'undefined' ? Boolean(
  serverEnv.TWILIO_ACCOUNT_SID
  && serverEnv.TWILIO_AUTH_TOKEN
  && serverEnv.TWILIO_VERIFY_SERVICE_SID,
) : false;
