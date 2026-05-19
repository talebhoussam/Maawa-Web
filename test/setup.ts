/**
 * Vitest setup — runs once before all test files.
 *
 * Loads test-mode env vars and stubs Next.js's `'server-only'` virtual
 * module so server-side files can be imported under jsdom/node without
 * blowing up.
 */

import { vi } from 'vitest';

/* `process.env.NODE_ENV` is typed as readonly in @types/node 22 — cast.
   Using a defineProperty would also work but adds noise. */
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';

process.env.NEXT_PUBLIC_FIREBASE_API_KEY              = 'AIzaTestKeyForTestsOnly12345678901234';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN          = 'test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID           = 'test';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET       = 'test.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID  = '123456789';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID               = '1:123456789:web:abcdef';
process.env.NEXT_PUBLIC_APP_URL                       = 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPPORT_PHONE                 = '+213233000000';
process.env.NEXT_PUBLIC_MC_RATE_DZD                   = '50';
process.env.NEXT_PUBLIC_CCP_NUMBER                    = 'CCP-TEST-0000-0000';
process.env.NEXT_PUBLIC_BARIDIMOB_NUMBER              = '+213555000000';
process.env.NEXT_PUBLIC_OFFICE_ADDRESS                = 'Test Office, Algiers';

process.env.FIREBASE_ADMIN_PROJECT_ID   = 'test';
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
process.env.FIREBASE_ADMIN_PRIVATE_KEY  = '-----BEGIN PRIVATE KEY-----\\nMIIBPLACEHOLDER1234567890123456789012345678901234567890123456789012345678901234567890\\n-----END PRIVATE KEY-----';

process.env.NEXTAUTH_SECRET = 'test_secret_at_least_32_chars_long_xxxxx';

process.env.PLATFORM_COMMISSION_RATE = '0.10';

/* `'server-only'` is a virtual module from Next.js that throws if
   imported into a client component. In tests we don't care; stub it. */
vi.mock('server-only', () => ({}));
