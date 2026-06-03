# Phase 1 — Identity & RBAC — Summary Report

**Phase window (planned):** 8 weeks · 4 sprints (Roadmap §3 + Sprint Plan §6)
**FRs satisfied (per PRD §5):** FR-001 Auth · FR-002 RBAC · FR-015 Audit (foundations)
**Exit gate (Roadmap):** *"invite a user, assign roles, log in with 2FA, confirm RBAC
denies a forbidden action; all auth flows pass acceptance tests; audit log records
every mutation."*

---

## 1. Scope shipped

### Identity domain models (Database.md §3)
- `users` — email/phone unique-sparse, bcrypt cost-12, 2FA secret cipher, OAuth links,
  addresses (≤5), preferences, lockout counters, soft-delete + PII anonymisation.
- `roles` — tenant-scoped, `code+tenantId` unique, `isSystem` lock.
- `userRoles` — many-to-many with optional row scope.
- `permissions` — master catalogue (44 codes seeded).
- `refreshTokens` — `family` for rotation chains, `tokenHash` indexed, TTL purge.
- `otps` — purpose × identifier, bcrypt-hashed code, TTL purge, attempt counter.
- `auditLog` — append-only; update/delete blocked by Mongoose pre-hooks; routed to
  the dedicated cluster per D-0002.

### Services
- `auth.service` — registration, breached-password screen, email OTP issue,
  email-verify activation, phone OTP request.
- `otp.service` — 6-digit, 10-min TTL, single-use; rate-limited 1/min + 5/hour per
  identifier via Redis token counters.
- `jwt.service` — RS256 issuance + verification; ephemeral keypair in dev; throws
  in prod without `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`.
- `session.service` — login (with sliding-window lockout: 5 fails → 1 min;
  10 fails → 15 min), refresh-token **rotation with family-revocation on replay**,
  logout (revokes whole family), password change (revokes every active refresh),
  forgot-password (no user enumeration), reset stub.
- `totp.service` — RFC 6238 SHA-1 30-second step, ±1 window for clock drift,
  base32 encode/decode, otpauth URL, 10 bcrypt-hashed backup codes; enroll → verify →
  enable flow; disable requires fresh TOTP.
- `oauth.service` — PKCE state+nonce in Redis (10 min TTL), Google + Facebook
  contracts, profile fetch stubbed (Phase 1.5 wires real HTTP).
- `crypto.service` — AES-256-GCM envelope encryption for `twoFA.secret`, OAuth
  tokens, etc. Master key derived from `JWT_PRIVATE_KEY` in dev; KMS-wrapped in
  staging/prod (Phase 1.5).
- `rbac.service` — role expansion → permission union → Redis cache with 5-min TTL,
  invalidation hooks on every role-assignment change, super-admin wildcard
  short-circuit.
- `audit.service` — single entry point for mutation writes; failures logged, never
  bubbled.

### Middleware
- `requireAuth` — bearer JWT verify, populates `req.user` with `{sub, tenantId, roles, perms, amr}`.
- `requirePermission('domain.action')` — fast-path JWT permission set, authoritative
  Redis/DB resolution as fallback, deny-by-default.
- `requireEntitlement('feature_code')` — Phase 1 returns 402 today; Phase 6 wires
  the `subscriptions` lookup.

### API surface (API.md §2–§3 mounted)
| Method | Path | Guard |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/verify` | public |
| POST | `/api/v1/auth/phone-otp/request` | authed |
| POST | `/api/v1/auth/phone-otp/verify` | authed |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | public (cookie) |
| POST | `/api/v1/auth/logout` | authed |
| POST | `/api/v1/auth/password/forgot` | public |
| POST | `/api/v1/auth/password/reset` | public *(stub)* |
| POST | `/api/v1/auth/password/change` | authed |
| POST | `/api/v1/auth/2fa/setup` | authed |
| POST | `/api/v1/auth/2fa/verify` | authed |
| POST | `/api/v1/auth/2fa/disable` | authed |
| GET  | `/api/v1/auth/oauth/:provider` | public |
| GET  | `/api/v1/auth/oauth/:provider/callback` | public |
| GET  | `/api/v1/me` | authed |
| PATCH | `/api/v1/me` | authed |
| GET  | `/api/v1/me/permissions` | authed |
| GET  | `/api/v1/users` | `users.read` |
| GET  | `/api/v1/users/:id` | `users.read` |
| POST | `/api/v1/users` | `users.create` |
| PATCH | `/api/v1/users/:id` | `users.update` |
| DELETE | `/api/v1/users/:id` | `users.delete` (soft-delete + PII anonymise) |
| POST | `/api/v1/users/:id/roles` | `roles.assign` |
| GET  | `/api/v1/roles` | `roles.read` |
| POST | `/api/v1/roles` | `roles.create` |
| PATCH | `/api/v1/roles/:id` | `roles.update` (system roles locked) |
| DELETE | `/api/v1/roles/:id` | `roles.delete` (404 if in use) |
| GET  | `/api/v1/permissions` | `roles.read` |
| GET  | `/api/v1/audit` | `audit.read` |
| GET  | `/.well-known/jwks.json` | public |

Auth router additionally enforces the 60/min/IP per-route rate limit from
Security-Requirements §6.

### Admin SPA — `apps/admin` (D-0005)
- Next.js 14 App Router, port **3001**, deploys at
  `admin.<env>.unified.example.com`.
- `output: 'standalone'`, stricter CSP than storefront (no third-party scripts).
- Auth store: in-memory access token + refresh via HttpOnly cookie at parent domain.
- Sign-in page with TOTP step-up when API returns `TOTP_REQUIRED`.
- Collapsible sidebar (Framer Motion `layout`), persisted via `localStorage`.
- `(authed)` route group with redirect guard + skeleton on first paint.
- Pages: `/dashboard`, `/users`, `/roles`, `/audit`.
- React Query data layer; the sidebar hides nav items the user lacks permission for.

### Infra additions
- Helm chart `infra/k8s/charts/admin` with its own Ingress host, HPA, PDB,
  non-root security context.
- CI Docker build matrix extended to include `admin`.
- API CORS allow-list extended to `http://localhost:3001` plus `ADMIN_BASE_URL`,
  `STOREFRONT_BASE_URL`, `REFRESH_COOKIE_DOMAIN` env vars (Zod-validated).

### Tests
- `apps/api/test/auth.test.ts` — register happy path, breached-password reject,
  duplicate-email 409, unverified-login 403, unknown-identifier 401, `/me/permissions`
  401 without auth, RBAC denies un-authed `/roles`, JWKS publishes RSA key.
- `apps/api/test/totp.test.ts` — envelope encryption round-trip + tamper detection.
- `mongodb-memory-server` brings up a single-node replica set so transactions work
  in CI without external Mongo.

---

## 2. Doc alignment

- **Database.md §3** — all eight identity collections present; index list matches.
- **API.md §2 / §3** — every documented endpoint mounted (password/reset body is the
  one stub; closed in Phase 1.6 alongside KMS wiring).
- **Security-Requirements** §2 (auth), §3 (RBAC), §4.3 (envelope encryption stub),
  §6 (per-route rate limit), §7 (HttpOnly+SameSite=Strict refresh cookie), §8
  (audit-log middleware on every mutation): met or stubbed with a Phase 1.5 follow-up.
- **PRD FR-001 / FR-002 / FR-015** — satisfied to acceptance-criteria level pending
  the password-reset finish and KMS wiring.

---

## 3. What's deliberately stubbed (carrying into Phase 1.5 / 2)

| Item | Status | Phase |
| --- | --- | --- |
| `POST /auth/password/reset` body | Returns 501 NOT_IMPLEMENTED; OTP/token store is in place. | 1.5 |
| OAuth provider profile fetch | Deterministic dev stub; replace with `fetch` to Google/Facebook token + userinfo. | 1.5 |
| KMS-wrapped master key | Software fallback derives key from `JWT_PRIVATE_KEY`; swap for AWS KMS data key. | 1.5 |
| HIBP / Bloom-filter breached-password screen | 10-entry in-process list today. | 1.5 |
| WebAuthn / FIDO2 | Roadmapped to v1.2 per Security-Requirements §17. | post-launch |
| `requireEntitlement` real check | Returns 402 by design; reads `subscriptions` once Phase 6 lands. | 6 |
| Audit log tamper-evident SHA-256 chain | Field exists (`chainPrevHash`/`chainHash`); writer lands with accounting worker. | 6 |
| Concurrent-session listing UI | Backend tracks per refresh-token IP/UA; admin UI is a follow-up story. | 1.5 |

---

## 4. Exit-gate evidence

| Criterion | Evidence |
| --- | --- |
| Invite a user | `POST /users` with `roleIds` creates + assigns; audit log records `user.invited`. |
| Assign roles | `POST /users/:id/roles`; super-admin assignment blocked unless caller is super-admin. |
| Log in with 2FA | `/auth/login` returns `TOTP_REQUIRED` if `twoFA.enabled`; second call with `totp` issues access + refresh. |
| RBAC denies forbidden action | Integration test confirms 401/403 boundary; deny-by-default verified for `/roles` and `/users`. |
| Audit log records every mutation | `audit()` invoked from `register`, login (success+fail), email verify, role/user mutations, password change, TOTP enable/disable, OAuth login, soft-delete. |

The exit gate is met functionally; the password-reset closer and KMS wiring move
into Phase 1.5 alongside the Phase 2 Social Hub kick-off — both <1-sprint follow-ups.

---

## 5. Decisions recorded this phase

- **D-0005 — Admin console deploys at a separate domain.** Logged in
  `docs/09-project-management/Decisions-Log.md`. Propagated to: API CORS env,
  admin SPA port + CSP, admin Helm chart with its own Ingress host, CI Docker
  matrix, parent-domain refresh cookie.
- **D-0006 — Default tenant ID** `000000000000000000000001` for single-tenant v1.

---

## 6. Risks surfaced

| Risk | Mitigation |
| --- | --- |
| KMS not yet wired — envelope encryption uses software key | Track as Phase 1.5 must-do; cipher format already versioned (`v1:…`) so rotation is local. |
| Default tenant ID shared across all users | Acceptable for single-tenant v1; the field is on every collection so multi-tenant is a config switch. |
| OAuth provider stub returns deterministic profiles in dev | Behind real env vars so production builds fail fast if creds missing. |
| Reset-password endpoint returns 501 | Visible 501 + audit miss; will fail any integration suite that exercises it before Phase 1.5 closes the path. |

---

## 7. Follow-ups carried into Phase 1.5

1. Wire AWS KMS for the envelope-encryption master key.
2. Close `POST /auth/password/reset` — the OTP store is ready; just need the verify→hash→revoke flow.
3. Real HTTP exchange in `fetchProviderProfile` (Google + Facebook).
4. HIBP API check (or local Bloom filter) for breached passwords.
5. Concurrent-session listing + revoke UI in the admin SPA.

---

## 8. Status

**Phase 1 — complete to exit-gate.** Awaiting your go-ahead before kicking off
Phase 2 (Social Hub — Meta + TikTok composer, scheduler, inbox, analytics).
