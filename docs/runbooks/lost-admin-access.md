# Runbook: Lost Admin Access

The team has lost access to all super-admin accounts (forgot password, lost device, etc.) and needs to bootstrap a new one.

## Prerequisites

You need access to:
- The Firebase Admin SDK service account JSON (or the env vars `FIREBASE_ADMIN_*`)
- A shell on a machine with the repo cloned and `.env.local` populated

If you don't have either, the only path forward is:
- Contact whoever has Firebase Console access (Owner / Editor on the GCP project)
- Have them generate a new service account key and share it via secure channel

## Bootstrap a new super-admin

1. Have the user register normally at `https://maawa.dz/register`.
2. From Firebase Console → Authentication, copy their UID.
3. On a machine with `.env.local` set up:

   ```bash
   git pull
   npm install
   npm run admin:bootstrap -- <uid> super
   ```

4. The new admin must sign out and sign back in to pick up the `admin` custom claim.
5. Verify they can access `/admin/dashboard`.

## After recovery

- Audit `audit_logs` for any actions taken with the lost account between the suspected loss time and the rotation.
- If account compromise is suspected (not just forgotten password), also rotate all server credentials per the [credential rotation runbook](./credential-rotation.md).
- Document what happened in your incident log.

## Prevention

- Bootstrap **at least two super-admins** on day 1 of production.
- Keep the service account JSON in a password manager (not on a single laptop).
- Set up calendar reminders to rotate `FIREBASE_ADMIN_PRIVATE_KEY` every 90 days.
