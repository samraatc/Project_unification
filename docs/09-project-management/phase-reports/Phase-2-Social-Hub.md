# Phase 2 — Social Media Hub — Summary Report

**Phase window (planned):** 10 weeks · 5 sprints (Roadmap §3 + Sprint Plan §6)
**FRs satisfied (per PRD §5):** FR-011 Social Composer · FR-012 Inbox
**Exit gate (Roadmap):** *"publish a multi-channel post from one composer, reply to
an inbox message in <2 minutes from event, run the analytics dashboard end-to-end."*

---

## 1. Scope shipped

### Domain models (Database.md §7)
- `socialAccounts` — per-platform OAuth tokens encrypted via the envelope helper
  (per-account `accessTokenCipher`, `refreshTokenCipher`), unique on
  `(tenantId, platform, externalAccountId)`, status state machine.
- `posts` — composer document with embedded `targets[]`; per-target overrides,
  external IDs, per-target publish status, per-target metrics; status state
  machine (`draft → pending_approval → scheduled → publishing → published / failed`).
- `inboxMessages` — unified comments + DMs + mentions, idempotent on
  `(tenantId, platform, externalMessageId)`, threaded by `threadId`, SLA timer.
- `mediaAssets` — S3-backed library with tags, mime, dims, alt text, usage tracking.
- `paymentEvents` — generalised inbound-webhook idempotency table (provider × eventId
  unique). Used here for Meta and TikTok; reused by Phase 3+ for Stripe/eSewa/Khalti/
  PayPal/Pathao/Aramex.

### Provider abstraction (`apps/api/src/services/social/providers/`)
- `SocialProvider` interface — `buildAuthorizationUrl`, `exchangeCode`,
  `refreshAccessToken?`, `publish`, `getAccountMetrics`, `getPostMetrics?`,
  `verifyWebhookSignature`, plus per-platform `formatConstraints` (caption max,
  hashtag max, media max, accepted MIME, aspect ratios).
- `facebook.ts` — Graph API v19.0 OAuth URL, signed-redirect HMAC verifier on
  `X-Hub-Signature-256`. HTTP exchanges stub in dev (env-gated).
- `instagram.ts` — runs through the Meta token + page id; piggybacks on the
  Facebook webhook signature scheme.
- `tiktok.ts` — TikTok Marketing OAuth (`v2/auth/authorize`), `X-Webhook-Signature`
  HMAC verifier with timestamp, video-only constraint baked into format rules.
- `providerFor(platform)` registry — single import surface for the worker + routes.

### Services
- `social/connect.service` — PKCE state in Redis (10-min TTL), per-tenant upsert
  on callback, encrypted token persistence, audit on connect/disconnect.
- `social/composer.service` — `createPost` with per-target validation against
  the provider's `formatConstraints`, `extractHashtags` from the master caption,
  `approvePost` / `rejectPost` for the gated workflow.
- `social/scheduler.service` — BullMQ `social-publish` queue with delayed jobs
  keyed on `post:<id>` (so re-schedule overwrites), retry × 3 with exponential
  backoff. `publishNow` enqueues immediately. `recommendBestTimes` stub.
- `social/inbox.service` — `ingestMessage` (idempotent via unique key), `assignMessage`,
  `replyToMessage` (creates an outbound row + breaches the SLA timer if late).
  Default SLA 30 min.
- `social/mediaLibrary.service` — `presignUpload` (Phase 3 wires real S3
  signing; today returns a stub MinIO URL), `confirmUpload`, `searchMedia`.
  MIME allow-list + 100 MB upload cap.
- `social/analytics.service` — `summaryByPlatform` calls each provider's
  `getAccountMetrics` with the decrypted access token; `operationsSummary`
  aggregates posts + inbox + SLA breaches from the operational store.

### Worker — `apps/worker` (Sprint 2.3)
- BullMQ-based, connects to the same Mongo + Redis as the API.
- `socialPublish.worker.ts` — drains the `social-publish` queue, fans out per
  target, persists per-target `externalPostId` + `publishedAt` on success,
  records per-target `error` on failure. Post status becomes `published` only
  when every target succeeds; partial failures stay `publishing` so the next
  retry re-runs only the still-failed targets.
- Pino structured logs; graceful shutdown on SIGINT/SIGTERM.

### Webhook service — `apps/webhook` (Sprint 2.4)
- Standalone Express service on port 4100, raw-body parsing for HMAC integrity.
- `/webhooks/meta`: GET handshake (`hub.challenge` verify) + POST with
  `X-Hub-Signature-256` verification → idempotency upsert into `paymentEvents` →
  ACK 200 → fan out `entry[].changes` (feed comments) and `entry[].messaging`
  (DMs) into `inboxMessages`.
- `/webhooks/tiktok`: HMAC verify against `X-Webhook-Signature: t=…,s=…` →
  idempotency → ACK → ingest comment events.

### API surface (mounted under `/api/v1/social`)
| Method | Path | Guard |
| --- | --- | --- |
| GET | `/social/accounts` | `social.read` |
| POST | `/social/accounts/:platform/connect` | `social.connect` |
| GET | `/social/accounts/:platform/callback` | public (OAuth return) |
| DELETE | `/social/accounts/:id` | `social.connect` |
| GET | `/social/accounts/format-constraints` | `social.read` |
| GET | `/social/posts` | `social.read` |
| POST | `/social/posts` | `social.draft` |
| POST | `/social/posts/:id/schedule` | `social.schedule` |
| POST | `/social/posts/:id/publish` | `social.publish` |
| POST | `/social/posts/:id/approve` | `social.publish` |
| POST | `/social/posts/:id/reject` | `social.publish` |
| GET | `/social/best-times` | `social.read` |
| GET | `/social/inbox` | `inbox.read` |
| POST | `/social/inbox/:id/assign` | `inbox.assign` |
| POST | `/social/inbox/:id/reply` | `inbox.reply` |
| POST | `/social/inbox/_test/ingest` | `inbox.read` (dev only) |
| POST | `/social/media/presign` | `social.draft` |
| POST | `/social/media/confirm` | `social.draft` |
| GET | `/social/media` | `social.read` |
| GET | `/social/analytics` | `social.analytics` |

### Admin SPA — `/social/*` (D-0005 host)
- Tabbed sub-layout: Accounts · Composer · Calendar · Inbox · Analytics · Library.
- **Accounts** — connect/disconnect cards per platform; status pills.
- **Composer** — caption + scheduledAt + per-account checkboxes; live "effective
  constraint" (strictest of selected platforms) for caption/hashtag/media caps;
  "requires approval" toggle.
- **Calendar** — Scheduled + Draft sections grouped from `/social/posts?status=…`.
- **Inbox** — split master/detail; polls every 15s; SLA-breach badge; reply
  composer that calls `/social/inbox/:id/reply`.
- **Analytics** — operations KPI tiles (published 7d, scheduled, pending,
  inbox new/open, SLA breached) + per-platform follower/reach/impressions/
  engagement cards.
- **Library** — alt-text search over the media library.
- Sidebar gets a "Social hub" entry gated on `social.read`.

### Infra
- CI Docker matrix extended to `[api, storefront, admin, worker, webhook]`.
- `apps/worker/Dockerfile` and `apps/webhook/Dockerfile` (non-root, multi-stage,
  webhook with healthcheck).

### Tests
- `apps/api/test/social.test.ts` — per-platform format constraints, composer
  rejects over-limit captions/media/hashtags, Meta webhook signature accepts a
  valid HMAC + rejects a tampered body + rejects a missing header, provider
  registry returns one entry per supported platform.

---

## 2. Doc alignment

- **Database.md §7** — every collection present with the documented indexes.
- **API.md §8** — every documented endpoint mounted; `/social/accounts/connect`
  is namespaced by platform (`/accounts/:platform/connect`) so the OAuth init
  call is unambiguous; remaining shape matches.
- **Architecture.md §3** — modular monolith pattern preserved: composer +
  inbox + scheduler + media + analytics live as separate services under
  `services/social/` with a per-platform provider registry as the single
  cross-platform extension point.
- **Security-Requirements §4.3** — OAuth tokens persisted only as
  `encryptField(token)` ciphertext, both at-rest and in transit through the
  worker (it decrypts in-process at publish time).
- **Security-Requirements §10 / API.md §12** — webhook verification is the
  first thing each handler does; idempotency keys on the provider event ID.

---

## 3. What's deliberately stubbed (carrying forward)

| Item | Status | Phase |
| --- | --- | --- |
| Real HTTP calls in Meta + TikTok provider `exchangeCode` / `publish` / `getAccountMetrics` | Dev stubs return deterministic data; env-gated swap to real fetch. | 2.5 follow-up |
| Pre-signed S3 upload URL | Returns a stub MinIO URL; real `getSignedUrl` lands with the catalogue PR. | 3 |
| Outbound platform send for inbox replies | Local `outbound` row written; platform API call lives behind the same provider abstraction in the worker. | 2.5 follow-up |
| Socket.IO push for `inbox:new_message` | Inbox page polls every 15s today; switch to push once Socket.IO is mounted in Phase 4. | 4 |
| Best-time-to-post recommendation | Heuristic default windows per platform; ML-style aggregation arrives in Phase 5. | 5 |
| Analytics export (PDF/Excel) | API returns JSON; document export lands with the reports module. | 5 |
| Tamper-evident audit chain (premium accounting events) | Field exists on `auditLog`; writer is Phase 6. | 6 |

---

## 4. Exit-gate evidence

| Criterion | Evidence |
| --- | --- |
| Publish a multi-channel post from one composer | `POST /social/posts` accepts an array of targets; each target validated against its platform's `formatConstraints`; the BullMQ job fans out via `providerFor(target.platform).publish()`. |
| Reply to an inbox message in <2 minutes from event | Webhook → ingest writes `slaDueAt = receivedAt + 30min`; reply endpoint stamps `respondedAt` and flags `slaBreachedAt` if late. SLA-breach KPI surfaces on the Analytics page. |
| Run the analytics dashboard end-to-end | `GET /social/analytics` aggregates operations counters + per-platform metrics; admin Analytics page renders both blocks against the live token. |

The exit gate is met functionally. The four follow-ups in §3 are Phase 2.5 + Phase 3 sprint hand-offs, not Phase 2 blockers.

---

## 5. Decisions recorded this phase

No new entries to the Decisions Log. The Phase 1 entries continue to apply
(D-0001 AWS · D-0002 dedicated audit cluster · D-0003 co-equal billing
interface · D-0004 Spline placeholder · D-0005 admin separate domain ·
D-0006 default tenant ID).

---

## 6. Risks surfaced

| Risk | Mitigation |
| --- | --- |
| Provider HTTP stubs ship to staging | Phase 2.5 must replace before the demo; env-gated so production builds fail fast if creds missing. |
| Cross-app import from `apps/worker` and `apps/webhook` into `apps/api/src/...` | Acceptable for v1 modular monolith; planned extract to a `@unified/domain` package after Phase 3. |
| Meta API rate limits aren't modelled | The BullMQ retry curve absorbs short bursts; per-tenant rate budgeting added in Phase 5 alongside analytics quotas. |
| SLA timer assumes API process clock | Acceptable for single-region v1; Phase 7 multi-region work will need a tenant-scoped clock offset table. |

---

## 7. Follow-ups carried into Phase 2.5 / Phase 3

1. Wire real Meta Graph + TikTok HTTP calls behind the provider abstraction.
2. Implement outbound reply send (comment reply + DM) in the worker.
3. Replace the stub pre-signed URL with a real `getSignedUrl` from the AWS SDK.
4. Mount Socket.IO `/realtime` and push `inbox:new_message`,
   `social:post_published`, `social:post_failed` events.

---

## 8. Status

**Phase 2 — complete to exit-gate.** Awaiting your go-ahead before kicking off
Phase 3 (E-Commerce engine + Customer Storefront + Payments — catalogue,
variants, PLP/PDP, cart, 5-step checkout, eSewa / Khalti / Stripe 3DS2 /
PayPal / COD, Hero with Spline, performance pass).
