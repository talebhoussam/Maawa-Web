# Maawa — Phase progress log

One line per completed phase. Most recent first.

## Phase 7 — 2026-05-18 — Admin polish, reports, deletions, final UX

### Audit (per brief step 1)
Twenty-one admin pages. Eight already read live data
(admins, bookings, coin-requests, dashboard, finance, missions,
support, users). Thirteen are prototype shells with hardcoded data
(ads, analytics, applications, audit, broadcast, categories,
denied, disputes, heatmap, moderation, settings, verification,
index). Scope discipline declared up-front: deliver the hard
must-haves (deletions, reports, polish on high-traffic surfaces);
the 13 stub pages stay as-is for a post-launch phase. Faking data
would have violated operating rule #3.

### Deletions
- `POST /api/admin/users/delete` — soft-delete. requireAdmin
  (super|manager) + Zod (uid, reason ≥5 chars). Anonymises the
  user doc (displayName→'Compte supprimé', strips email/phone/
  firstName/lastName/avatarUrl/bio), sets deleted/deletedAt/
  deletedBy/deletedReason/banned/available:false. Calls
  `adminAuth.updateUser({disabled:true})` and
  `adminAuth.revokeRefreshTokens(uid)` in separate try/catch blocks
  so one failure doesn't block the other. Audits
  `admin.user.soft_delete` with reason. Does NOT touch posts /
  transactions / messages — they have their own moderation paths
  and financial audit must survive.
- `POST /api/admin/content/delete` — hard-delete posts / reels /
  stories / comments. requireAdmin + Zod. Reels map to
  feed_posts (reels live there as `type==='reel'`); comments
  require an additional `parentId`. Captures a JSON-serializable
  snapshot of the doc into the audit log BEFORE deletion so a
  manual restore is possible. Best-effort Storage cleanup by
  walking `mediaUrl / mediaPath / videoUrl / posterUrl / thumbUrl
  / photos[]` (strips `gs://bucket/` prefix). Audits
  `admin.content.delete` with the snapshot + `storageDeleted[]` +
  `storageFailed[]`.
- Admin users page: new Trash-icon column action → confirm modal
  with required 5-char reason field → POSTs to the delete route.

### Reports
- New collection `reports` with schema (reporterId, targetKind,
  targetId, reason enum, note≤500, status, createdAt, reviewedBy,
  reviewedAt, resolution). Targets: user / post / reel / story /
  ad / comment. Reasons: spam / harassment / fake / inappropriate
  / fraud / other.
- `firestore.rules` `/reports`: create by reporter with strict
  whitelist + enum guards + status forced to 'open'; admins read
  all, reporter reads own; no client update/delete.
- `firestore.indexes.json`: `(status, createdAt)` and
  `(reporterId, createdAt)` composites.
- `POST /api/reports/submit` — Zod validation, idempotency not
  enforced (multi-report signal is useful), audits `report.submitted`.
- `POST /api/admin/reports/resolve` — three actions:
  - `dismiss`: status→'dismissed' only.
  - `remove_content`: inlines the content-delete logic (snapshot
    capture + Storage cleanup), then resolves the report.
    Comment-removal guarded — submit doesn't capture parentId
    yet, so the branch throws with a clear message; logged
    follow-up.
  - `ban_user`: inlines the soft-delete logic, then resolves.
  Audits `admin.report.resolved` with action + targetKind +
  targetId + note.
- `components/ReportButton.tsx` — plug-and-play "Signaler" button
  + modal. 6 reason radios + optional note (≤500). Wrapped in
  `useRequireAuth` so guests get the connect-or-call modal. Wired
  into feed post actions (post/reel kind autodetected from `post.type`).
- `app/admin/(shell)/reports/page.tsx` — four-tab admin inbox
  (Ouverts / En cours / Résolus / Rejetés). Live `onSnapshot` per
  tab with `limit(50)`. Per-row Resolve dropdown: Rejeter /
  Supprimer (content kinds) / Bannir (user kind). Reporter name
  hydrated from /users/{uid} with an in-module cache. Loading /
  empty / error states all wired with retry.
- Admin sidebar: new "Signalements" entry with a flag SVG.
  `nav_reports` / `pt_reports` / `pt_reports_sub` × FR/EN/AR in
  `lib/i18n-admin.ts`.

### Final UX pass
- Light-mode color audit completed for platform-side pages
  (feed/missions/explore/post-card border). The remaining
  `rgba(255,255,255,...)` instances live inside dark-gradient
  surfaces (wallet hero, dashboard revenue chart, auth pages,
  quote panel, message bubbles, seed, not-found) which were
  verified to be deliberate.
- Feed post-card border swapped from `rgba(255,255,255,.06)` to
  `var(--border)` (was invisible in light mode).

### Performance
- `limit(50)` added to every live Firestore query in the
  codebase that lacked one: useMissions, useTransactions, useFeed,
  useNotifications, useAdminMissions, useAdminUsers, saved/page,
  useFollowingIds (capped at 500 — bigger than reasonable user
  count). Declines collectionGroup capped at 200. Chat messages
  intentionally unbounded (single thread).
- `sentry.client.config.ts` now defers init via
  `requestIdleCallback` (1.5s setTimeout fallback for Safari).
  Saves ~50 kB and a few hundred ms of LCP-blocking JS work
  per cold load. Accepts a tiny window of unmonitored startup
  errors as the tradeoff.

### Final cleanup
- `console.log` sweep: clean (zero occurrences in app/lib/components).
- `TODO/FIXME/HACK` sweep: stale Phase-3 forward-reference in
  /dashboard rewritten as a follow-up note; one documented
  TODO remains in /api/admin/reports/resolve for the
  comment-removal-needs-parentId boundary (intentional).
- PROGRESS.md up to date through Phase 7.
- README.md unchanged this phase (no setup steps added).

### Final verification (deliverable)
- `docs/AUDIT.md` updated with Phase 7 Final Scorecard:
  Security 4/5, Reliability 4/5, Performance 4/5, Observability
  4/5, UX 3/5, Operations 3/5 — **22/30, CONDITIONAL GO**.
  Conditions: rotate Firebase creds, set prod env vars, Twilio
  approval, deploy Firestore indexes. All other items are
  post-launch.

### Tests
- `test/reports-submit.test.ts` (9 cases): 401 unauthenticated;
  valid submit writes doc with reporterId from session +
  status='open'; null `note` when omitted; audit row shape;
  rejects unknown targetKind/reason/oversize note/missing
  targetId; all 6 valid reasons accepted.

### Pipeline
- lint ✔, tsc ✔, tests 158/158 ✔ (was 149, +9), build ✔.
- 4 new API routes in the build manifest:
  /api/admin/users/delete, /api/admin/content/delete,
  /api/admin/reports/resolve, /api/reports/submit.
- 1 new admin page: /admin/reports.

### Items punted (called out at start, not silent cuts)
- 13 admin stub pages (ads/analytics/etc.) — left honest with
  prototype shells. A full rewrite is a phase on its own.
- Comment-removal in reports — guarded TODO.
- Responsive-breakpoint sweep + Lighthouse audit — limited audit
  only.
- `next/image` for avatars — deferred to post-launch.

## Phase 6 — 2026-05-18 — Follow / badges / guest mode / artisan parity

### Audit (per brief step 14)
Pre-Phase-6 state: no follow system, no shared verified-badge
component (CSS pill `.badge-v` used inconsistently), no sponsored
flag, full middleware gating of every platform route (guests
couldn't see anything). The artisan-mode toggle was visible to
everyone — clients saw 👤/🔧 pills even with no artisan role.
Artisan-only pages (`/artisan/bookings`, `/artisan/calendar`,
`/artisan/earnings`) did not exist. Bidirectional ratings and the
explore map are not touched in this phase — flagged as follow-ups.

### Follow system
- New collection `follows` with composite doc id
  `{followerId}_{followingId}` — natural uniqueness, idempotent
  re-follow via `set` rather than duplicate rows.
- Rules: public read, owner-create with self-follow guard, owner-delete,
  no updates. Strict keys whitelist.
- Indexes: `(followerId, createdAt desc)`, `(followingId, createdAt desc)`.
- `POST /api/follow` — Zod, refuses self-follow, idempotent first-vs-
  re-follow detection, writes a `notifications` doc only on first
  follow (no spam), audits `social.follow`.
- `POST /api/unfollow` — idempotent delete; audits only when deleted.
- `lib/follow.ts` — `useIsFollowing()` (live single-doc snapshot +
  optimistic flip), `useFollowCounts()` (one-shot
  `getCountFromServer` aggregations), `useFollowingIds()` (live
  set used by the Suivis tab + ranking boost).
- Profile page: Follow/Abonné ✓ toggle button wrapped in
  `useRequireAuth`. Real follower / following counts under the
  display name.
- Feed page: new **Pour vous / Suivis** tabs (Suivis tap wrapped in
  requireAuth for guests). Activity ranking — followed authors get
  a ×2 effective recency multiplier in the "Pour vous" sort. Suivis
  tab filters posts to `followingIds.has(authorId)`.

### Verified + Sponsored badges
- `components/VerifiedBadge.tsx` — shared twelve-point starburst
  checkmark, renders only on `verified === true`, with title +
  aria-label "Artisan vérifié par Maawa". Used on profile header,
  feed post author, sidebar artisan header, chat header (Phase 5
  already in place), reels, story author (StoryViewer header), and
  artisan suggestion cards in support chat.
- `components/SponsoredBadge.tsx` — "Sponsorisé" label under
  author name (Meta-style). Used in feed posts.
- `POST /api/admin/content/sponsor` — admin-only flip of the
  `sponsored` flag on `feed_posts` / `stories` (reels live in
  `feed_posts`); audits `admin.content.sponsor`.
- `firestore.rules` — `feed_posts.create` refuses client-side
  `sponsored: true` initialisation; the flag is server-only.

### Guest mode
- `middleware.ts` PROTECTED_PLATFORM narrowed to
  `['/wallet', '/missions', '/dashboard', '/chat', '/notifications',
    '/settings', '/apply', '/saved', '/artisan']`. Removed: `/feed`,
  `/explore`, `/reels`, `/categories`, `/profile`, `/quote`.
  `/admin/*` + `/seed/*` still gated.
- `firestore.rules` `/feed_posts` read relaxed to `if true` so
  guests can browse the feed; +1-like rule still requires sign-in.
- `app/api/public/profile/route.ts` — new public endpoint returning
  the safe subset of a user doc (never `phone` / `email`). Used by
  `/profile/{id}` so guests can view profiles without us relaxing
  the `users` collection rule.
- `lib/hooks.ts` — `useFeed()` dropped its `uid` gate (relies on
  the now-public read rule).
- `components/ConnectOrCallModal.tsx` — the shared modal: two
  primary CTAs ("Créer un compte" / "Se connecter") + tertiary
  "📞 Appeler Maawa" using `NEXT_PUBLIC_SUPPORT_PHONE`. Plus
  `useRequireAuth()` hook + `openConnectModal()` event opener.
  Communication: a `maawa:require-auth` CustomEvent decouples the
  trigger from the mounted modal element so any nested handler can
  fire it without prop drilling. Mounted once in the platform
  layout.
- `useRequireAuth` wraps actions on guest-touchable surfaces:
  feed like + bookmark + suivis-tab, reels like / save / comment /
  boost (replaces the Phase 4 toast stub), explore Réserver +
  Chat, profile Follow + Réserver + Chat + Save buttons.
- `Topbar.tsx` — Client/Artisan toggle gated on
  `user?.role === 'artisan'`. When `user === null`, the right side
  swaps chat/notif/avatar/logout for **"Se connecter"** +
  **"S'inscrire"** CTAs.

### Artisan parity (minimum-viable per audit default)
- `app/(platform)/artisan/layout.tsx` — client-side gate that
  redirects non-artisans to `/feed`. Middleware gates anonymous.
- `/artisan/bookings` — split into "Demandes en attente" + "Missions
  confirmées". Pending list reads
  `missions where status=='pending'` and filters out the artisan's
  own declines (sub-collection query against `collectionGroup(declines)
  where artisanId == uid`). Accept + Refuser buttons → new API
  routes. Confirmed list reads `missions where artisanId == uid &&
  status in [confirmed, in_progress]`.
- `/artisan/calendar` — month grid built without a calendar lib;
  groups confirmed/in-progress/terminee missions by `scheduledAt ??
  confirmedAt ?? createdAt` day; tap a day to expand its mission
  list. Mon-Sun layout matching FR locale conventions.
- `/artisan/earnings` — payable-balance hero (live `users/{uid}.payableBalance`
  snapshot), "Demandes de retrait" panel (live
  `payout_requests where userId == uid`), "Paiements récents" panel
  (live `transactions where userId == uid && kind == 'mission_payout'`).
  Withdraw button disabled with "Bientôt disponible" (real flow
  ships later).
- `POST /api/artisan/mission/accept` — transactional: re-verifies
  artisan role + verified + mission status='pending' + no other
  artisan; flips status to 'confirmed', sets artisanId, writes
  `notifications` to the client, audits `mission.accepted`.
- `POST /api/artisan/mission/decline` — writes
  `missions/{id}/declines/{artisanUid}` with optional reason;
  mission stays 'pending' for other artisans; audits
  `mission.declined`.
- `firestore.rules` — new `/missions/{id}/declines/{artisanUid}`
  sub-collection: owner + admin read, server-only write.
- `firestore.indexes.json` — composite indexes
  `(artisanId asc, status asc, createdAt desc)` and
  `(status, wilaya, createdAt desc)` for the artisan-bookings
  and pending-by-wilaya queries.
- Sidebar artisan section: new entries Demandes / Calendrier /
  Revenus, sandwiched between Tableau de bord and Portfolio.
- `ArtisanModeWatcher` recognises `/artisan/*` as an artisan route
  (auto-flips `mode` to 'artisan' so the right sidebar variant is
  shown).

### i18n
- 17 new strings × FR/EN/AR added to `lib/i18n-platform.ts`:
  feed tabs, follow / following / abonnés labels, connect-modal
  copy, sponsored label, verified tooltip, topbar guest CTAs.

### Tests
- `test/follow.test.ts` (7 cases): unauthenticated 401; self-follow
  400; first-follow writes doc + notif + audit; re-follow is
  idempotent (no extra writes); unfollow deletes + audits when
  present; unfollow idempotent on missing doc.
- `test/guest-mode.test.tsx` (8 cases, jsdom): modal renders
  nothing initially; opens via `openConnectModal()`; uses
  default title without action label; formats title with the
  action verb; Créer / Se-connecter buttons route correctly;
  `useRequireAuth` opens modal for guest; runs action immediately
  for signed-in user; safe default — opens modal when auth state
  hasn't initialised yet.

### Pipeline
- lint ✔, tsc ✔, tests 149/149 ✔ (was 134, +15), build ✔.
- 6 new API routes: `/api/follow`, `/api/unfollow`,
  `/api/admin/content/sponsor`, `/api/artisan/mission/accept`,
  `/api/artisan/mission/decline`, `/api/public/profile`.
- 3 new pages: `/artisan/bookings`, `/artisan/calendar`,
  `/artisan/earnings`.

### Verification I'd run locally (per brief)
1. **Logout → /feed** loads with stories rail (no "Ma story" tile),
   feed posts visible, top-right shows "Se connecter" / "S'inscrire".
2. **Tap a like** → ConnectOrCallModal opens "Connectez-vous pour
   aimer" with the three CTAs.
3. **Visit /profile/{any-uid}** as guest — page loads via
   `/api/public/profile` (no Firestore rule rejection); Suivre /
   Réserver buttons trigger the modal on tap.
4. **Login as a client** (role:'client'): topbar shows avatar +
   logout but no 👤/🔧 toggle; /apply is reachable; /artisan/*
   redirects to /feed.
5. **Login as a verified artisan**: 👤/🔧 toggle visible in topbar.
   Switch to artisan mode → sidebar shows Demandes / Calendrier /
   Revenus. /artisan/bookings shows pending missions in the
   user's wilaya; accept button POSTs and the mission flips to
   confirmed in real-time.
6. **As admin**, POST /api/admin/content/sponsor with a feed_post
   id and `sponsored: true` — the post on /feed now shows the
   "Sponsorisé" badge under the author name.

### Follow-ups for the next phase
1. **Bidirectional star ratings** — brief step 16. Existing
   `RatingModal` does client-rates-artisan only. The artisan-rates-
   client mirror plus the recompute-average server route is
   outstanding.
2. **Explore Google Map** — brief step 17 says "confirm Google Map
   shows artisan pins from Firestore". The `ArtisanMap` component
   exists (dynamic-imported in `/explore`); pin data wiring and a
   functioning maps key are next.
3. **Artisan profile editor extra fields** — brief step 15 lists
   trade / experience / hourly rate / service-area multi-select /
   available toggle as new settings sections. Settings page is
   currently client-only. Tracked.
4. **"Other" trade in apply flow** — brief step 18 says admin
   should be able to accept and auto-create a new category. Need
   to verify the existing apply form supports "other" + admin path.
5. **Sponsor admin UI** — the `/api/admin/content/sponsor` route
   exists but no admin page calls it yet. Probably a checkbox in
   the existing moderation / content review pages.
6. **Mission-status workflow buttons** — accept/decline are wired;
   "Commencer mission" (confirmed → in_progress) and "Terminer
   mission" (in_progress → terminee) aren't yet. Tracked as the
   bidirectional-rating prompt's prerequisite.

## Phase 5 — 2026-05-17 — Full messenger + Maawa Support auto-suggest

### Audit (per brief step 1)
The pre-Phase-5 chat page had a `useChat` + live `onSnapshot` skeleton
that worked but missed almost every messenger affordance: no read
receipts, no typing indicator, no attachments, no reply quoting, no
two-pane desktop layout, no search, no support thread, no way to
sort conversations (chat doc never wrote `lastMessageAt`). Avatar
clicks routed to `/profile/{chatId}` (the chat ID, not the peer UID),
guaranteeing 404. The `unread` field was read but never written.

The model was tangled enough that a rewrite was faster than patching;
PROGRESS.md keeps the audit verbatim.

### Rules + indexes
- `firestore.rules` /chats — admin reads on `isSupport == true`
  threads; per-message `readBy`/`readAt` update allowed for any
  participant; chat-doc `update` whitelist gained `typing` and
  `typingAt`. Support chats allowed to create with
  `participants = [user, '_maawa_support'] + isSupport: true`.
- `firestore.indexes.json` — composite index on
  `(isSupport asc, lastMessageAt desc)` for the admin support inbox.

### API routes
- `POST /api/chat/send-to-support` — Zod text (1..2000). Writes user
  message, bumps admin-side unread, audits
  `support.user_message_sent`. Looks up user's wilaya then queries
  `users where role='artisan' verified==true available==true
   wilaya==<userWilaya> orderBy rating desc limit 10`; samples 3 at
  random (Fisher-Yates on the top 10). Schedules a 2.5 s delayed
  bot reply (`setTimeout`) in prod; writes synchronously in tests.
  Three reply variants: full (3), partial (<3, "broaden zone"),
  zero (audits `support.zero_artisans_flag` for the manual queue).
  No-wilaya fallback when the user doc lacks one.
- `POST /api/admin/chat/reply` — admin-only; refuses non-support
  chats as defence-in-depth; writes a `_maawa_support`-sent message
  with `actualSender = admin.uid` for audit; bumps user-side unread;
  audits `admin.support.reply`.
- `lib/support-bot.ts` — extracted helpers (`sampleArtisansForSupport`,
  `writeSupportAutoReply`, `composeBotReplyText`, `supportPlaceholderUid`)
  so they're test-importable. Route files in Next 15 can't export
  arbitrary symbols.
- `/api/me/register-profile` — additionally creates the deterministic
  support chat doc `chats/maawa-support_{uid}` idempotently (skips
  if it already exists).

### Frontend rewrite (`app/(platform)/chat/page.tsx`)
- Suspense wrapper around the page body (required for `useSearchParams`).
- Two-pane on viewports ≥900 px (matchMedia); master-detail on mobile.
  Active chat ID lives in `?c=` so it's shareable + back-navigable.
- `ChatListItem` — gradient ring + 🛟 icon for support; SUPPORT
  badge; unread badge; freshest-first sort with support pinned to
  the top; search bar (peer name OR last message).
- `ChatThread`:
  - Live `onSnapshot` on messages (ordered asc).
  - **Read receipts**: extracted helper `markUnreadAsRead` from
    `lib/messenger-read.ts` batches `readBy: arrayUnion(uid)` on
    every unread message + resets `unread[uid]=0` on the chat doc.
    Helper kept Firestore-instance-agnostic so the test can mock it.
  - **Typing**: throttled `typing: { [uid]: serverTimestamp }`
    update every 1.5 s of typing; cleared to `Timestamp(0)` after
    5 s of silence. Peer's typing detected by recency comparison.
    Support thread suppresses typing writes (bot can't see them).
  - **Single / double ticks**: per-message render via `readBy`
    count — double when ≥1 other participant has acknowledged.
  - **Timestamps**: every 5 minutes between messages a divider
    shows the time; bubbles also show the time inline.
  - **Attachments**: image-only, 10 MB cap, written to
    `chats/{chatId}/{senderUid}/{ts}-{name}` via the existing
    storage rule. The message is `kind: 'image'` with `imageUrl`.
  - **Reply-to-message**: 350 ms long-press (pointer events; also
    listens for right-click as a desktop fallback) captures the
    bubble as `replyTo`; the next send embeds it as a quoted
    block above the bubble text.
- `MessageBubble` knows three flavours: regular `text`,
  attachments (`kind: 'image'`), and **artisan suggestion cards**
  (`kind: 'artisan_suggestions'`) — each renders as a tappable
  card showing avatar / displayName / trade / rating, navigating
  to `/profile/{userId}`.
- `SuggestionAvatar` — resolves Storage URLs lazily via
  `lib/storage-url.resolveStorageUrl`.
- Sending in a support thread goes through
  `/api/chat/send-to-support` instead of a direct write so the
  bot auto-reply fires.

### Admin panel
- `app/admin/(shell)/support/page.tsx` — live list of all
  `chats where isSupport == true` ordered by `lastMessageAt` desc;
  per-row admin-side unread badge; two-pane inline thread reader
  with reply input that posts to `/api/admin/chat/reply`.
- Admin sidebar: new "Support" entry with a lifebuoy SVG.
- i18n: `nav_support`, `pt_support`, `pt_support_sub` × FR/EN/AR.

### Tests
- `test/messenger-support.test.ts` (9 cases): 401 unauth;
  user-message written with correct `readBy`; chat-doc updated
  with user text; full reply (≥3 artisans) — verifies 3 suggestions
  + wilaya in text; partial reply (<3) — "broaden zone" wording;
  zero reply — explicit message format + `support.zero_artisans_flag`
  audit row; no-wilaya fallback — no artisan query issued; 400 on
  empty / over-length text. Asserts the artisan query was filtered
  by user wilaya + `verified==true` + `available==true` + `role==artisan`.
- `test/messenger-read-receipts.test.ts` (6 cases): `unreadByMe`
  filters correctly; missing `readBy` treated as empty; `readByUpdate`
  payload shape; `markUnreadAsRead` updates exactly the right docs
  via batch and returns the count.

### Pipeline
- lint ✔, tsc ✔, tests 134/134 ✔ (was 119, +15), build ✔.
- New routes in the build output: `/api/chat/send-to-support`,
  `/api/admin/chat/reply`.

### How I'd verify locally (per the brief)
1. Register a new user → `chats/maawa-support_{uid}` is created
   server-side. The new chat page shows "Maawa Support 🛟" pinned
   at the top.
2. Open the support thread → input placeholder is "Posez votre
   question à Maawa…". Send "J'ai besoin d'un plombier" → it
   appears immediately with a single tick.
3. ~2.5 s later the bot replies with a card list of 3 artisans
   in your wilaya. Tapping a card routes to `/profile/{uid}`.
4. Have another participant (peer in a regular chat) start typing
   → three animated dots appear above the input row. Stop typing
   for 5 s → dots disappear.
5. Open the other participant's view of the thread → unread badge
   in the list clears, all your messages flip from single to
   double tick.
6. As admin, open `/admin/support` → the freshly created thread
   sits at the top with an unread count; click to reply.

### Follow-ups for the next phase
1. Connect-or-call modal (Phase 6 will replace the reels-guest
   stub toast with a real component).
2. Emoji picker — currently the input accepts paste / native emoji
   only; no picker grid.
3. Per-message reactions (Slack-style) — not in the brief, but the
   `readBy` field's shape is similar so the rule's `onlyAllowed`
   would gain a `reactions` entry.
4. Push notifications via FCM for new messages (Phase 7+).
5. Encrypted attachments — currently images get a permanent
   `getDownloadURL`; for sensitive content the chat page should
   fetch admin-style signed URLs via a server route.
6. Cloud Function to write the bot reply so an in-flight request
   isn't required to hold the process for 2.5 s; the route stays
   stateless in prod.

## Phase 4 — 2026-05-17 — Stories from scratch + Reels playback

### Reels diagnosis (per brief step 8)
The reels page had **no `<video>` element anywhere** — only an empty
state. Feed reels rendered a gradient `<div>` placeholder with an
emoji, never an actual video. This wasn't a "broken playback" bug; the
feature was never built. Phase 4 is therefore a build-from-scratch.

Secondary issues that would have surfaced once a `<video>` was added:
autoplay would be blocked without `muted` + `playsInline`; Storage
paths are stored as bare paths (no `videoUrl` field on `feed_posts`
documents — the placeholder hardcoded an emoji); no scroll-snap or
IntersectionObserver, so multiple videos would all play at once or
none. CORS is fine — `getDownloadURL()` returns
`firebasestorage.googleapis.com` URLs that work for `<video>` directly.

### Stories — backend
- New collection `stories` with rules:
  - `read: true` (public-by-design — guests can watch).
  - `create`: caller's userId + strict key whitelist + kind-specific
    validation (text 1-200 chars + gradient 0-4, OR photo + mediaUrl)
    + `views == 0`.
  - `update: false` (counter goes through the API).
  - `delete`: author only.
- Sub-collection `stories/{id}/viewers/{uid}` for idempotent view
  tracking. Read by story owner + admin; write server-only.
- Storage rule `/stories/{userId}/{file}` — public read, owner write,
  10 MB image only.
- New composite index on `(expiresAt, createdAt desc)`.

### Stories — API
- `POST /api/stories/create` — Zod discriminated union on `kind`;
  for photo stories, verifies the upload exists under `stories/{uid}/`;
  sets `expiresAt = now + 24h` server-side; audits `story.created`.
- `POST /api/stories/view` — runs inside a transaction reading both
  the story doc and the viewer marker; increments `views` only when
  the viewer hasn't already viewed AND isn't the owner. Marks the
  viewer in `viewers/{uid}` either way (owners' viewing is tracked
  but doesn't pad the counter).

### Stories — frontend
- `lib/stories.ts` — `useStories()` hook subscribes to active
  stories (`expiresAt > now`), groups by user (latest per user
  first), hydrates author displayName + avatar from `users/{uid}`
  with an in-module cache.
- `components/platform/StoriesRail.tsx` — horizontal rail at the
  top of `/feed`. First slot: "Ma Story" tile that opens the
  creator modal if no active story or opens the viewer focused
  on the user's group when one exists (with a floating `+` button
  to publish another). Hidden for guests. Following slots: one
  circle per user with gradient ring + initials/avatar.
- `components/platform/StoryViewer.tsx` — full-screen overlay:
  per-slide progress bars at top, 5-second slide duration via
  `requestAnimationFrame`, tap-left/right for prev/next, long-press
  (>220ms) pauses, swipe-down (>80px deltaY) closes, ESC + arrow
  keys for keyboard. Photo stories render with a resolved
  `getDownloadURL`; text stories use one of 5 gradient backgrounds.
  Signed-in viewers fire `/api/stories/view` per slide.
- `components/platform/modals/StoryCreateModal.tsx` — tab-based
  creator (Photo / Texte). Photo tab uploads to
  `stories/{uid}/{ts}-{name}` via the Firebase Storage client SDK
  before POSTing. Text tab has a live preview on the chosen gradient
  with a 200-char counter. Mounted in the platform layout alongside
  the other modals; opens via `#story-create-modal.on`.

### Reels — rebuild
- `lib/storage-url.ts` — new `parseStorageRef()` (pure, sync) and
  `resolveStorageUrl()` (async). Handles bare paths, `gs://` URIs,
  and pre-resolved https URLs; never throws — returns `null` on
  failure so callers can fall back gracefully. In-module URL cache
  (Map) avoids duplicate `getDownloadURL` calls per page life.
- `app/(platform)/reels/page.tsx` — full rewrite. Subscribes to
  `feed_posts where type='reel'` (`limit(50)`); drops rows without
  a `videoUrl`/`mediaUrl` field rather than rendering a broken
  `<video>`. Single IntersectionObserver instance drives play/pause:
  visibility ≥ 50% → `play()`, otherwise `pause()` + `currentTime=0`
  per spec. All videos default to muted (autoplay requirement);
  tapping a video toggles mute platform-wide and flashes a brief
  🔇/🔊 icon. Vertical scroll-snap container (`scroll-snap-type:
  y mandatory`; each reel is `100vh` with `scroll-snap-align: start`).
  Side actions: Like (uses existing `+1` increment rule), Comment
  (stub toast), Share (`navigator.share` + clipboard fallback),
  Save (writes to `saved/*`), Boost (owner-only, routes to /wallet
  — actual deduction lives with the deferred spend flow).
- Guest mode on action taps: a stub toast saying "Créez un compte
  pour interagir" — Phase 6 will replace with the shared
  connect-or-call modal.

### i18n
- 13 new platform strings × FR/EN/AR for the creator modal,
  errors, and the reels-guest CTA.

### Tests
- `test/stories-create.test.ts` — 11 cases: 401 unauth; valid
  text + photo creates; text > 200 / empty text / out-of-range
  gradient / missing mediaPath / cross-user mediaPath / missing
  storage file / unknown kind / text without gradient → all 400.
  Asserts `createdAt + 24h === expiresAt` exactly.
- `test/reels-url.test.ts` — 12 cases: `parseStorageRef` against
  nullish / https / http / gs:// / bare path / leading-slash
  rejection / whitespace trimming. `resolveStorageUrl` paths:
  null shortcut (no SDK call); https returned unchanged;
  bare path triggers getDownloadURL; gs:// strips the scheme
  before calling `ref()`; SDK failure → null without throwing.

### Pipeline
- lint ✔, tsc ✔, tests 119/119 ✔ (was 96, +23), build ✔.
- New routes shipped in the build output:
  `/api/stories/create`, `/api/stories/view`.
- `/reels` page grew from 1.09 kB (empty state) to 5.08 kB
  (real player). `/feed` from 5.51 kB to 8.33 kB (stories rail).

### How I would verify locally (per brief's "show me a working demo")
With Firebase configured in `.env.local`:
1. Run `npm run dev`; sign in.
2. Tap "Ma Story" on the feed rail → text tab, type "Hello", pick
   the second gradient, Publish → the rail now shows a "Ma story"
   circle with a sky-blue ring + your initial.
3. Tap your circle → full-screen viewer with the progress bar
   filling left-to-right over 5 seconds; long-press anywhere to
   pause; swipe down to close.
4. Sign in as a second user, view the first user's story →
   `views` counter on the source doc increments by 1 (and stays
   at 1 even if you reload).
5. Seed a `feed_posts` doc with `type:'reel'` and a `videoUrl`
   pointing at a real Storage path (use the seed page or write
   directly in Firestore). Open `/reels` → the first reel
   auto-plays muted, scroll-snaps vertically, tap toggles mute.

### Follow-ups for the next phase
1. **Cloud Function to sweep expired stories.** Until then the
   client filters on read (it does) and Storage objects accumulate.
2. **Per-viewer seen-state for stories** so the rail ring dims for
   already-watched groups (Instagram-style). The `viewers/`
   sub-collection already has the data; just need a query.
3. **Real upload flow for reel videos** — `feed_posts where type='reel'`
   exists but nothing writes a `videoUrl` field today. The reels
   page is honest about it (empty state when no playable reels)
   but the create flow is still missing.
4. **Comments on reels.** The brief says "opens existing comment
   thread or empty state" — no comment thread component exists,
   so I stubbed with a toast.
5. **Boost flow.** Owner sees a 🚀 button on their own reel; tapping
   it just routes to /wallet today. Phase 5+ should wire a real
   server-side MC debit + reel-boost duration field.

## Phase 3 — 2026-05-17 — Coin purchase request + admin review

### Backend
- New collection `coin_purchase_requests` with full Firestore rules:
  user creates own with status='pending' + amountMC in [100,10000]
  + strict key whitelist; admin OR owner can read; server-only update.
- `storage.rules`: `/coin_proofs/{userId}/{file}` — admin/owner read,
  owner write under 5 MB image-only.
- `firestore.indexes.json`: composite indexes on `(userId, createdAt)`
  and `(status, createdAt)` for coin_purchase_requests.
- `lib/env.ts`: three new optional public vars
  `NEXT_PUBLIC_CCP_NUMBER`, `NEXT_PUBLIC_BARIDIMOB_NUMBER`,
  `NEXT_PUBLIC_OFFICE_ADDRESS`; documented in `.env.example`.

### API routes
- `POST /api/wallet/purchase-request` — Zod-validated body
  (amountMC int 100-10000, paymentMethod enum, optional reference,
  optional proofPath); if proofPath provided, verifies file exists
  AND lives under the caller's `/coin_proofs/{uid}/` folder; creates
  request doc; audits `wallet.purchase_request_created`; returns
  `{requestId, amountDZD, instructions: {ccp|baridimob|officeAddress}}`.
- `POST /api/admin/wallet/approve-request` — requireAdmin; one
  Firestore transaction: re-verifies status==='pending' (refuses
  double-approval), re-validates amountMC range belt-and-braces,
  flips status, increments `users/{uid}.maawaCoinBalance` via
  `FieldValue.increment`, writes a `transactions` doc of kind
  `coin_purchase`; audits `admin.coin.approve`.
- `POST /api/admin/wallet/reject-request` — requireAdmin; reason
  min 3 chars; transaction flips status to 'rejected' and writes the
  reason; never touches user balance; audits `admin.coin.reject`.
- `GET /api/admin/wallet/proof-url` — admin-only signed-URL minter
  for proof thumbnails; 5-min expiry; refuses paths outside the
  `coin_proofs/` prefix.

### Frontend
- New `components/platform/modals/RechargeModal.tsx` — Phase 3
  modal: slider + numeric input (min 100, step 50, max 10000) with
  live DZD equivalent; CCP / Baridimob / Cash radio + disabled "Carte
  bancaire — Bientôt disponible"; method-aware reference placeholder;
  proof upload to Firebase Storage `coin_proofs/{uid}/{ts}-{name}`
  (5 MB, image-only client-side check before write); submit → API;
  success view swaps to operator instructions ("Virez X DZD au
  CCP Y, motif MAAWA-Z"); resets state on modal close via
  MutationObserver.
- Mounted in `app/(platform)/layout.tsx` alongside other modals.
- Wallet page: new "Mes demandes" section (live Firestore
  subscription on `coin_purchase_requests where userId==uid`); each
  row shows amount in MC + DZD, method, date, status badge (orange/
  green/red), and the admin's reject reason when applicable. Hidden
  when the user has no requests.
- New admin page `app/admin/(shell)/coin-requests/page.tsx` —
  three tabs (Pending / Approved / Rejected) with live counts;
  per-row Approve + Reject buttons opening native React confirmation
  modals (Approve confirms with mc + dzd; Reject requires ≥3-char
  reason); proof thumbnails open in a lightbox via the signed-URL
  endpoint; user displayNames hydrated once into a cache so re-renders
  don't re-fetch.
- Admin sidebar: new "Demandes Coins" entry between Finance and
  Disputes with a coin glyph.

### i18n + helpers
- `lib/useT.ts` — React-friendly `useT(scope?)` hook with
  `{placeholder}` interpolation, FR fallback, then key fallback.
- `lib/i18n-platform.ts`: 37+ recharge keys × 3 languages (FR / EN /
  AR) covering modal labels, method names, errors, status badges,
  instruction templates, and the admin tabs + confirmation copy.
- `lib/i18n-admin.ts`: `nav_coin_requests`, `pt_coin_requests`,
  `pt_coin_requests_sub` × 3 languages; page-title map entry for
  `coin-requests`.

### Tests
- `test/wallet-purchase-request.test.ts` — 20 cases:
  - **Create:** 401 unauth; valid creates doc + audit; correct
    instruction per method (ccp/baridi/cash); 400 for amount <100,
    >10000, non-integer, unknown method; 400 for proofPath outside
    caller folder; 400 for missing proof file; 200 with proofPath
    stored.
  - **Approve:** 403 non-admin; 200 increments balance + writes
    coin_purchase transaction + audit; 409 already-approved; 404
    missing.
  - **Reject:** 403 non-admin; 400 reason <3 chars; 200 captures
    reason and does NOT call tx.set (no balance change, no txn row);
    409 already-approved.

### Pipeline
- lint ✔, tsc ✔, tests 96/96 ✔ (was 76, +20), build ✔.

### Follow-ups for the next phase
1. Notification to the user when admin approves/rejects (currently
   they need to refresh the wallet page; the snapshot does pick it
   up live but they may not be looking).
2. Withdrawal flow ("Retrait") — symmetric to recharge but with admin
   creating a debit; button is still disabled in the wallet hero.
3. "Spend" buttons (Boost Profil, Boost Reel, etc.) on the wallet
   page — server-side balance debit + audit log; currently all
   disabled with "Bientôt".
4. Operator-side tooling to set the 3 payment-instruction env vars
   per environment (these are intentionally blank by default; the
   instructions view falls through to `rch_inst_missing` until set).

## Phase 2 — 2026-05-17 — Real data only, 58 wilayas, admin Ads icon
- Added `lib/wilayas.ts` — all 58 post-2019 Algerian wilayas, FR/AR
  names, `displayLabel`/`parseWilaya`/`localName` helpers, codes
  typed as `WilayaCode`.
- Wired all wilaya pickers to the single source: register, settings,
  apply, quote, BookingModal, TenderModal, plus the admin users /
  missions / bookings filter dropdowns.
- `lib/i18n-platform.ts` auto-injects `wil_01`…`wil_58` keys for
  FR/EN/AR at module init so AR rendering still works with the
  expanded picker.
- New public endpoint `app/api/public/stats/route.ts` — Admin-SDK
  counts of verified artisans + clients, 5-min CDN cache, threshold
  of 10. Landing page rewrites use this; below threshold it shows
  qualitative copy. "48 wilayas" lie → "58 Wilayas" (real).
- Sidebar: fake nearby-artisans list removed; fake static badges
  (2/3/7) → real `useChat`/`useNotifications`/`useMissions` counts
  rendered only when > 0; "Karim Plombier" artisan header + fake
  KPI tiles → real `user.displayName`/`trade`/`wilaya`/balance;
  "Rejoignez +3 800 artisans" → "Rejoignez la communauté Maawa";
  "Devenir Artisan" CTA hidden for users already in artisan role.
- Feed: hardcoded `STORIES` array removed; rail shows only the
  "+ Ma Story" tile for logged-in users (real `stories` collection
  lands in Phase 4). Defensive `'karim'` fallback removed from the
  profile link.
- Notifications: empty-state copy matches brief.
- Chat: empty state "Aucune conversation. Commencez en contactant
  un artisan." + CTA to /explore.
- Wallet: removed fake monthly stat tiles (+820 / -470 / +120 /
  🥈), removed "Maawa Rewards" card entirely (depended on a
  non-existent `loyaltyLevel`). Recharger button now opens a
  recharge-request modal id (Phase 3 wires the modal). Withdraw +
  Agence + each "Activer" button is `disabled` with "Bientôt
  disponible" — no more dishonest toast-only stubs. Empty
  transactions list now has a "+ Recharger" CTA. Rate read from
  `NEXT_PUBLIC_MC_RATE_DZD` instead of hardcoded 50.
- Categories: removed 12 fake per-category artisan counts, fixed
  "32 métiers" header (was wrong; shows 12) to render the real list
  length.
- Profile/[id]: removed fake portfolio gradient tiles, fake reviews,
  fake price list, fake certifications, fake "⭐ Expert" badge,
  fake "Avis (89)" label. Each tab now renders an honest empty
  state until the corresponding collections (reviews / portfolio /
  pricing) ship. Stats tiles only render the fields actually
  present on the user doc.
- Dashboard (artisan): removed fake 4.9★, fake 1247 views,
  decorative trends. Revenue chart bars now computed from the
  user's own `transactions` (credits, grouped by ISO week of the
  current month); empty months show an "Aucune activité ce mois"
  overlay.
- BookingModal + RatingModal: "Karim Plombier" placeholders → em
  dashes / generic "l'artisan" copy; the DOM ids stay so they can
  be filled at open time by the booking trigger.
- Saved: was four fully hardcoded tiles. Now reads `saved/*` from
  Firestore, joins with `feed_posts`, real Tabs (Tous / Artisans /
  Posts), honest empty state + CTA.
- Admin sidebar: Ads entry now uses an inline Megaphone SVG (no
  new deps).
- i18n: neutralised "+3 800 artisans" mentions across `apply_sub`
  and `app_desc_main` for FR/EN/AR.
- `UserProfile` type gained `verified?: boolean`.

## Phase 1 — 2026-05-17 — Auth UX hardening, referral removal, password change
- Added `lib/auth-errors.ts` (FR/EN/AR translations of Firebase Auth codes,
  field-targeted hints, defensive code extraction for wrapped errors).
- Rewrote `app/(auth)/login`, `app/(auth)/register`, `app/(auth)/forgot-password`
  with field-targeted red borders, inline error text, banner for non-field
  errors, error clears on edit, aria-invalid/describedby, Enter-to-submit.
- New page: `app/(platform)/settings/password` — current-password
  reauthenticate → updatePassword; distinguishes which password input
  is at fault.
- Settings row "Changer mon mot de passe" now points to `/settings/password`
  instead of `/forgot-password`.
- Removed the referral-code (parrainage) field, state, and validateRefCode
  function from registration; removed unused `.ref-field` / `.ref-tag` CSS
  and dead `t_ref_lbl` i18n keys (FR/EN/AR).
- Added `--input-error` CSS var and `.has-error`/`.field-error`/
  `.form-error-banner` styles for the dark auth card, plus parallel
  `.pf-fi`/`.pf-field-error`/`.pf-error-banner` for light-mode platform
  forms.
- Updated `set_security` i18n key (FR/EN/AR) so the language switcher
  doesn't overwrite the new "Changer mon mot de passe" label with the
  old "Sécurité & Connexion" wording.
- Tests: added `test/auth-errors.test.ts` (34 cases): required-code
  mapping, field detection, default fallback, code extraction from
  various error shapes, EN/AR localisation.
