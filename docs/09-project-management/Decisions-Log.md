# Decisions Log

A running list of cross-cutting decisions taken outside the formal docs. Each entry
is dated, scoped, and points at the artefacts that depend on it.

---

## D-0001 — AWS as primary cloud
**Date:** 2026-06-02 · **Phase:** 0 · **Decided by:** Sponsor (via Sprint 0 sign-off)

Terraform skeleton and Helm charts target AWS only (EKS + Atlas + ElastiCache + S3 + ACM).
GCP modules are not maintained. Affects `infra/terraform/**`, `infra/k8s/**`,
`.github/workflows/terraform-plan.yml`.

## D-0002 — Dedicated Atlas cluster for the audit log
**Date:** 2026-06-02 · **Phase:** 0 · **Decided by:** Sponsor

`atlas_audit` provisioned alongside `atlas_primary` in `infra/terraform/envs/dev/main.tf`.
WORM-mounted object shards land with Phase 6 when Atlas tier supports it; placeholder
TODO in the module today. Audit log writes will be routed via a dedicated Mongoose
connection in Phase 1.4.

## D-0003 — Billing providers are co-equal behind a `BillingProvider` interface
**Date:** 2026-06-02 · **Phase:** 0 · **Decided by:** Sponsor

Stripe + eSewa + Khalti share a common contract. No Stripe-first assumption is wired
in. Interface lands in Phase 6 (`apps/api/src/services/billing/`); dunning + entitlement
state machine consumes it.

## D-0004 — Hero ships a placeholder until Spline asset is delivered
**Date:** 2026-06-02 · **Phase:** 0 · **Decided by:** Engineering (pending design handoff)

`apps/storefront/src/components/Hero.tsx` ships a layered gradient + parallax skeleton
with a `TODO(design)` marker. Real `.splinecode` asset owed by the design lead.

## D-0005 — Admin console deploys at a separate domain
**Date:** 2026-06-03 · **Phase:** 1 · **Decided by:** Sponsor

The Next.js admin SPA (`apps/admin`) is **not** mounted under the storefront domain.
It deploys to a dedicated host — e.g. `admin.<env>.unified.example.com` —
independently of the storefront. This affects:

- **Helm.** `infra/k8s/charts/admin/` ships its own chart with its own `Ingress` host;
  the storefront chart's host stays `shop.<env>.…`. Admin chart added in Phase 1.5.
- **Ingress / DNS.** A separate ACM cert SAN already covers `*.<env>.unified.example.com`
  (`infra/terraform/modules/acm`). DNS record for the admin host is added in the
  `envs/dev` outputs when the chart deploys.
- **CORS.** `apps/api` `CORS_ALLOWED_ORIGINS` env var must include the admin host
  (per-env). Storefront and admin origins are listed separately so the API can apply
  per-origin policies (admin gets stricter CSP, no public read endpoints from this
  origin).
- **Cookies.** Refresh-token cookies are scoped to `.unified.example.com` (parent
  domain) so admin SSO works without re-login when the user moves between hosts.
  `SameSite=Strict; Secure; HttpOnly` retained per Security-Requirements §7.
- **CSP.** Admin gets a stricter `Content-Security-Policy` (no third-party scripts,
  no inline styles) configured in `apps/admin/next.config.mjs`.
- **Auth redirect.** Admin sign-in flow lives at `admin.<env>…/sign-in`. Storefront
  sign-in flow stays at `shop.<env>…/sign-in`. They share the same `/api/v1/auth/*`
  endpoints; only the redirect targets differ.
- **CI.** Docker build matrix in `.github/workflows/ci.yml` extends to include
  `admin` alongside `api` and `storefront`.

## D-0006 — Default tenant ID for single-tenant v1
**Date:** 2026-06-03 · **Phase:** 1 · **Decided by:** Engineering

All `tenantId` fields default to the ObjectId `000000000000000000000001` for v1
single-tenant operation. The field is kept on every collection so multi-tenant is a
configuration switch rather than a migration (Database.md §1).

## D-0007 — Invoice PDF library = `pdfkit` for v1
**Date:** 2026-06-03 · **Phase:** 3 · **Decided by:** Engineering

`pdfkit` chosen over `puppeteer` for invoice rendering. Lower runtime cost, no
Chromium dependency, sufficient fidelity for transactional invoices. Revisit with
marketing if richer templates are needed for premium plans. Affects
`apps/api/src/services/invoices/invoice.service.ts` and the `apps/worker` invoice
generation queue.

## D-0008 — Stripe Elements over Stripe Checkout
**Date:** 2026-06-03 · **Phase:** 3 · **Decided by:** Engineering

Stripe Elements keeps the payment form inside the storefront (preserves Neumorphic
visual control) while keeping PCI scope at SAQ-A (no card data ever touches our
servers). Stripe Checkout would simplify integration but breaks the visual brand.
Affects `apps/api/src/services/payments/stripe.gateway.ts` and the storefront
`/checkout` payment step.

## D-0009 — Search backend selection
**Date:** 2026-06-03 · **Phase:** 3 · **Decided by:** Engineering

Three backends, switched via `SEARCH_BACKEND` env var:
- `atlas` (default in staging/prod) — MongoDB Atlas Search with the index spec at
  `infra/atlas-search-indexes/products.json`.
- `mongo` (default in dev/test) — regex fallback so `mongodb-memory-server` works.
- `meili` (reserved for self-hosted enterprise tenants) — Meilisearch adapter.

The fallback path is deliberate: CI can run search tests without Atlas, and
self-hosted tenants who cannot use Atlas have a documented path.

## D-0010 — SMS routing: Sparrow for NPR, Twilio for everything else
**Date:** 2026-06-04 · **Phase:** 4 · **Decided by:** Engineering

E.164 numbers starting with `+977` route to Sparrow SMS; all other numbers route
to Twilio. The decision lives in
`apps/api/src/services/notifications/channels/sms.ts`. The caller imports a single
`smsChannel` and never sees the split.

## D-0011 — Notifications outbox is always used, even in dev
**Date:** 2026-06-04 · **Phase:** 4 · **Decided by:** Engineering

Domain code never calls the SMS / email / push adapters directly. Every event
writes a row to `notificationOutbox` and the `notifications-dispatch` worker
drains it. This keeps one code path for dev / staging / production and makes
testing trivial (assert against the outbox collection).

## D-0012 — Courier webhook signature schemes per provider
**Date:** 2026-06-04 · **Phase:** 4 · **Decided by:** Engineering

- Pathao: `Authorization: Bearer <shared-secret>` + `X-Pathao-Signature: <hmac>`.
- Aramex: `X-Aramex-Signature: sha256=<hmac>`.

Both adapters live behind a `CourierProvider` contract so adding DHL/UPS later
is a one-file PR (`apps/api/src/services/couriers/providers/<provider>.ts`).
The shared secret is stored ciphertext in `couriers.webhookSecretCipher`,
decrypted in-memory at webhook time, rotated via admin UI.

---

## How to add an entry

1. Pick the next free `D-XXXX` code.
2. Add date, phase, decider, the decision, and a list of artefacts it affects.
3. Reference the entry in PR descriptions when it shapes code.
4. If a decision is reversed, do not delete the entry — append a `**Superseded by D-YYYY**`
   line at the bottom so the history is preserved.
