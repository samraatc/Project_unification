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

---

## How to add an entry

1. Pick the next free `D-XXXX` code.
2. Add date, phase, decider, the decision, and a list of artefacts it affects.
3. Reference the entry in PR descriptions when it shapes code.
4. If a decision is reversed, do not delete the entry — append a `**Superseded by D-YYYY**`
   line at the bottom so the history is preserved.
