#!/usr/bin/env tsx
/**
 * Bootstrap the first super-admin.
 *
 * Run with:
 *   npm run admin:bootstrap -- <uid> [role]
 *
 * Example:
 *   npm run admin:bootstrap -- 9F2Bx7yz... super
 *
 * This script uses the Firebase Admin SDK directly — it does NOT go
 * through the public API. Required because /api/admin/users/promote
 * itself requires an existing super-admin to call it (chicken-and-egg).
 *
 * After this script, all subsequent admin promotions go through the API.
 *
 * Pre-requisites: FIREBASE_ADMIN_* env vars must be set (load .env.local
 * before running, or set them in the shell).
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';

/* tsx auto-resolves .ts paths but the dotenv default file is .env which
   we don't ship. Try .env.local first. */
if (existsSync('.env.local')) loadEnv({ path: '.env.local' });
else                          loadEnv();

import { adminAuth, adminDb } from '../lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

async function main() {
  const [, , uid, roleArg] = process.argv;
  if (!uid) {
    console.error('Usage: npm run admin:bootstrap -- <uid> [super|manager|ops]');
    process.exit(1);
  }
  const role = (roleArg ?? 'super') as 'super' | 'manager' | 'ops';
  if (!['super', 'manager', 'ops'].includes(role)) {
    console.error(`Invalid role "${role}". Must be super, manager, or ops.`);
    process.exit(1);
  }

  /* Verify the user exists. */
  const user = await adminAuth().getUser(uid).catch(() => null);
  if (!user) {
    console.error(`User ${uid} not found in Firebase Auth.`);
    console.error('Have them register at /register first, then re-run this command.');
    process.exit(1);
  }

  console.log(`Bootstrapping admin role for:`);
  console.log(`  uid:   ${user.uid}`);
  console.log(`  email: ${user.email ?? '(none)'}`);
  console.log(`  role:  ${role}`);

  /* Set custom claims. */
  await adminAuth().setCustomUserClaims(uid, { admin: true, role });

  /* Mirror in Firestore. */
  await adminDb().collection('users').doc(uid).set(
    { isAdmin: true, adminRole: role, updatedAt: Timestamp.now() },
    { merge: true },
  );

  /* Force re-auth to pick up new claims. */
  await adminAuth().revokeRefreshTokens(uid);

  /* Audit. */
  await adminDb().collection('audit_logs').add({
    actor:     'bootstrap-script',
    action:    'admin.promote',
    target:    uid,
    meta:      { role, via: 'cli' },
    createdAt: Timestamp.now(),
  });

  console.log('✅ Done. The user must sign out and sign back in for claims to take effect.');
}

main().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
