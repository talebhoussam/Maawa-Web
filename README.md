# Maawa — Web

Algerian artisan marketplace. Next.js 15, React 19, Firebase backend, deployed as a server-rendered app.

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                │
│  • React Server / Client Components                             │
│  • Firebase JS SDK (auth, Firestore reads/writes via rules)     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Next.js Edge Runtime  (middleware.ts)            │
│  • Reads __session cookie                                       │
│  • Gates /admin/*  (redirects unauth to /admin/login)           │
│  • Gates /seed/*   (404 in production unless flag set)          │
│  • Redirects /login if already signed in                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            Next.js Node Runtime — API routes (/api/*)           │
│  • Firebase Admin SDK (privileged ops only)                     │
│  • Zod-validated input                                          │
│  • RBAC via custom claims (admin, role: super|manager|ops)      │
│  • Rate-limited (in-memory; swap for Redis at scale)            │
│  • Audit-logged for every privileged mutation                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Firebase                               │
│  • Auth (phone OTP via Twilio Verify, email/password)           │
│  • Firestore (rules in firestore.rules)                         │
│  • Storage (rules in storage.rules)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Quick start

### Prerequisites

- Node 20+
- A Firebase project (one for dev, one for prod recommended)
- A Twilio account with Verify Service for SMS OTP — required for production, optional for dev (a fixed code `123456` is accepted when Twilio isn't configured)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in your values
cp .env.example .env.local
$EDITOR .env.local        # Fill in Firebase + Twilio + secrets

# 3. Verify the env loads cleanly
npm run type-check

# 4. Run the dev server
npm run dev
```

### Environment variables

See `.env.example` for the full annotated list. The important categories:

| Group | Files | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | client | Browser-safe but must be HTTP-referrer restricted in Cloud Console |
| `FIREBASE_ADMIN_*` | server only | Service account JSON, **NEVER commit** |
| `TWILIO_*` | server only | OTP SMS — production requires Algerian SMS sender approval |
| `NEXTAUTH_SECRET` | server only | 32+ chars, generate via `openssl rand -base64 32` |
| `PLATFORM_COMMISSION_RATE` | server | Decimal, e.g. `0.10` for 10% |
| `ENABLE_SEED_ROUTES` | server | `true` enables `/seed/*` in dev; ignored in production |
| `NEXT_PUBLIC_CCP_NUMBER` | client | CCP account shown to users when they submit a coin recharge request (Phase 3) |
| `NEXT_PUBLIC_BARIDIMOB_NUMBER` | client | Baridimob number shown alongside CCP (Phase 3) |
| `NEXT_PUBLIC_OFFICE_ADDRESS` | client | Cash-payment office address shown in the recharge modal (Phase 3) |
| `NEXT_PUBLIC_MC_RATE_DZD` | client | 1 MC → DZD rate; defaults to 50 in code (Phase 3) |
| `NEXT_PUBLIC_SUPPORT_PHONE` | client | Used by the "📞 Appeler Maawa" CTAs across the app (Phases 5/6) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | client | Required for the /explore artisan map (Phase 6 follow-up) |
| `NEXT_PUBLIC_SENTRY_DSN` | client | Optional; when set, client-side errors are reported to Sentry. Init is deferred behind `requestIdleCallback` (Phase 7). |

## Bootstrapping the first admin

The `/api/admin/users/promote` endpoint requires an existing super-admin. To create the very first one:

1. Have the user register normally at `/register`.
2. Get their UID from Firebase Console > Authentication.
3. Run on the server (with `.env.local` present):

```bash
npm run admin:bootstrap -- <uid> super
```

This sets the `admin` custom claim, mirrors the role into Firestore, and revokes their refresh tokens so they pick up the claim on next login.

After this, all subsequent admin promotions go through the API.

## Deploy

### Firestore + Storage rules

Rules MUST be deployed before the app code that depends on them. Use the Firebase CLI:

```bash
npm install -g firebase-tools  # one-time
firebase login
firebase use <your-project-id>
npm run deploy:rules           # deploys firestore.rules + indexes + storage.rules
```

The rules file `firestore.rules` is the production source-of-truth — changes there must be reviewed carefully because client write paths depend on them.

### App

The app is platform-agnostic Next.js. Tested deployment targets:

- **Vercel** (recommended for low-ops): just connect the repo, set env vars in the dashboard.
- **Cloud Run / Docker**: any standard Next 15 standalone build works. The `/api/health` endpoint is the readiness probe.
- **Self-hosted Node**: `npm run build && npm run start`.

In all cases:
1. Set every env var from `.env.example` in the platform's secret manager.
2. Set `NODE_ENV=production`.
3. Verify `/api/health` returns 200 before routing traffic.

### Pre-deploy checklist

- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] All `FIREBASE_ADMIN_*` and `TWILIO_*` env vars set in production
- [ ] `NEXT_PUBLIC_SENTRY_DSN` set (if using error tracking)
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_KEY` restricted by HTTP referrer in Cloud Console
- [ ] `ENABLE_SEED_ROUTES` is unset or `false` in production
- [ ] First super-admin bootstrapped via `npm run admin:bootstrap`
- [ ] `/api/health` returns 200

## Development workflow

```bash
npm run dev              # dev server
npm run lint             # ESLint
npm run type-check       # tsc --noEmit
npm run test             # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright (requires running dev server)
npm run ci               # lint + type-check + test + build (full pre-commit gate)
```

## Project structure

```
maawa-next/
├── app/                          Next.js App Router
│   ├── (auth)/                   Login, register, OTP, forgot-password
│   ├── (platform)/               Authenticated platform pages
│   ├── admin/                    Admin panel (gated by AdminAuthGuard + middleware)
│   ├── api/                      Server-side endpoints (see below)
│   └── seed/                     Dev-only data seeding (gated by ENABLE_SEED_ROUTES)
├── components/                   Shared React components
├── lib/                          Server-shareable utilities
│   ├── api.ts                    Auth helpers, error builders, audit, route wrapper
│   ├── env.ts                    Zod-validated env (fails fast on bad values)
│   ├── firebase.ts               Client SDK init
│   ├── firebase-admin.ts         Admin SDK init (server only)
│   ├── logger.ts                 Pino structured logger with PII redaction
│   ├── ratelimit.ts              In-memory sliding-window rate limiter
│   └── store.ts                  Zustand store
├── scripts/
│   └── bootstrap-admin.ts        First-admin bootstrap
├── test/                         Vitest unit + integration tests
├── firestore.rules               Firestore security rules
├── storage.rules                 Storage security rules
├── middleware.ts                 Edge middleware (auth gate)
├── next.config.mjs               Security headers, image config
└── .github/workflows/ci.yml      GitHub Actions CI
```

## API endpoints

All endpoints under `/api`. Every privileged endpoint requires a valid `__session` cookie; endpoints under `/api/admin/*` additionally require the `admin` custom claim.

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | none | Readiness probe |
| `/api/auth/session-login` | POST | ID token in body | Exchange ID token for HttpOnly session cookie |
| `/api/auth/session-logout` | POST | session | Clear cookie + revoke refresh tokens |
| `/api/auth/otp/send` | POST | none | Send SMS OTP via Twilio |
| `/api/auth/otp/verify` | POST | none | Verify OTP, mint custom token |
| `/api/me/profile` | GET / PUT | session | Read / update own profile (whitelisted fields) |
| `/api/me/register-profile` | POST | session | Create initial profile, always sets role=client |
| `/api/applications/submit` | POST | session | User submits artisan application |
| `/api/safepay/confirm-payment` | POST | admin | Office payment received |
| `/api/safepay/release` | POST | admin | Release escrow to artisan |
| `/api/safepay/refund` | POST | admin | Refund client (full or partial) |
| `/api/admin/users/promote` | POST | super-admin | Grant admin custom claim |
| `/api/admin/users/ban` | POST | super/manager | Disable account, revoke sessions |
| `/api/admin/applications/approve` | POST | admin | Approve artisan application |
| `/api/admin/applications/reject` | POST | admin | Reject artisan application |
| `/api/admin/missions/assign` | POST | admin | Assign artisan to mission |

## Runbooks

See [`docs/runbooks/`](./docs/runbooks/) for incident response procedures:

- [Credential rotation](./docs/runbooks/credential-rotation.md)
- [Payment dispute](./docs/runbooks/payment-dispute.md)
- [Account ban / unban](./docs/runbooks/ban-unban.md)
- [Lost admin access](./docs/runbooks/lost-admin-access.md)

## Security

If you find a security issue, please email `security@maawa.dz` rather than opening a public issue.

The full audit + production readiness assessment is in [`docs/AUDIT.md`](./docs/AUDIT.md).
