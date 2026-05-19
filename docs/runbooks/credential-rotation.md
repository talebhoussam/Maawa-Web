# Runbook: Credential Rotation

When to use this: a credential has been leaked, exposed in a screenshot, committed to git, or any time you suspect compromise.

**Time to complete: ~15 minutes per credential.**

## 1. Firebase Admin SDK private key

The biggest risk — this key bypasses all Firestore/Storage rules.

1. Go to [Firebase Console](https://console.firebase.google.com) → your project → ⚙ Settings → **Service accounts**.
2. Click **Manage service account permissions** (opens Google Cloud Console).
3. Click on the `firebase-adminsdk-xxx@…` service account → **Keys** tab.
4. **Delete the existing key first** (this immediately invalidates it).
5. Click **Add Key → Create new key → JSON** → save the downloaded file.
6. Open the JSON. Copy the values:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (wrap in double quotes, preserve `\n` literals)
7. Update env vars on every deployment target (Vercel/Cloud Run/etc.).
8. Redeploy. Verify `/api/health` returns 200.
9. **Delete the JSON file** from your local machine.

## 2. Twilio Auth Token

1. Go to [Twilio Console](https://console.twilio.com) → Account → **API keys & tokens**.
2. Under "Live credentials" find **Auth Token** → click the rotate icon.
3. Confirm rotation. The old token is invalid immediately.
4. Copy the new token → `TWILIO_AUTH_TOKEN` in your env.
5. Redeploy. Test by sending an OTP via the `/api/auth/otp/send` flow.

## 3. NextAuth secret

```bash
openssl rand -base64 32
```

Paste the output as `NEXTAUTH_SECRET`. Side effect: every existing session cookie is invalidated, so all users are logged out.

## 4. Firebase client API key

This one is browser-public by design but should be referrer-restricted. If it's been used outside your domains:

1. Go to [Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials).
2. Click the API key → **Application restrictions** → **HTTP referrers**.
3. Restrict to your domains only:
   - `https://maawa.dz/*`
   - `https://*.maawa.dz/*`
   - `http://localhost:3000/*` (development only)
4. **API restrictions**: select only the APIs you actually use (Identity Toolkit, Firestore, Storage, etc.).

If the key has been actively abused, regenerate it:
1. Same screen → click **+ Create credentials → API key**.
2. Set the same restrictions.
3. Update `NEXT_PUBLIC_FIREBASE_API_KEY`.
4. Delete the old key.

## 5. Google Maps API key

Same procedure as Firebase client key — the Maps key has billing implications, so always set:

1. Referrer restriction.
2. API restriction (Maps JavaScript API, Places API, Geocoding API only).
3. **Daily budget alert** in Cloud Billing → Budgets & alerts.

## 6. After rotation — verify the leak surface

For any committed credential, check git history:

```bash
git log --all --full-history -p -- .env.local
git log --all --full-history -p | grep -E "AIza|sk-|AC[a-f0-9]{32}" | head
```

If credentials appear in history, the only correct response is to **rotate everything you found** — rewriting git history doesn't help if the repo has ever been pushed.

## 7. Post-rotation checklist

- [ ] All env files updated on every deployment target
- [ ] Build deploys cleanly with new credentials
- [ ] `/api/health` returns 200
- [ ] OTP send works (check Twilio console for delivery)
- [ ] Admin login works
- [ ] No regressions in error tracking (Sentry receives events)
- [ ] Old credentials confirmed invalid (try them — should fail)
