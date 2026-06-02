# Technical Requirements Document (TRD)

**Project:** Unified Marketing & E-Commerce Management Platform
**Stack:** MERN (MongoDB, Express, React, Node.js) + Next.js 14
**Version:** 1.0

---

## 1. Stack Summary

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + Tailwind CSS + Framer Motion + GSAP + Spline | SSR storefront, admin SPA, accounting portal, PWA |
| State / Data | Redux Toolkit + RTK Query + React Query | UI state, server cache |
| Backend | Node.js 20 + Express 4 | REST APIs, webhooks |
| Real-time | Socket.IO | Order updates, inbox events, notifications |
| Database | MongoDB 7 (Atlas) + Mongoose | Primary store |
| Search | MongoDB Atlas Search (with optional Meilisearch fallback) | Catalogue full-text + faceted search |
| Cache / Queue | Redis 7 + BullMQ | Sessions, cart cache, rate limit, job queue |
| Object Storage | AWS S3 / Cloudflare R2 | Images, invoices, social assets |
| Auth | JWT (15-min access + 7d refresh) + OAuth 2.0 + 2FA TOTP | Stateless secure access |
| Email | SendGrid | Transactional + marketing |
| SMS | Twilio + Sparrow SMS (NPR) | OTP + transactional |
| Push | Firebase Cloud Messaging | Browser + PWA push |
| Payments | Stripe, eSewa, Khalti, PayPal, COD | Multi-gateway checkout + subscription billing |
| Social APIs | Meta Graph (FB + IG), TikTok Marketing | Post, schedule, analytics, inbox |
| Courier APIs | Pathao, Aramex | Tracking webhook ingest |
| Tax | Nepal IRD e-invoice, GSTR-1/3B exporter | Regulator-ready returns |
| Hosting | AWS EKS or GCP GKE | Kubernetes; auto-scaling |
| CDN | CloudFront / Cloud CDN + Cloudflare | Edge cache, WAF |
| CI/CD | GitHub Actions + Terraform | Build, test, deploy, IaC |
| Observability | Sentry + Datadog + OpenTelemetry | Errors, APM, infra metrics |
| Security | WAF, TLS 1.3, AES-256, HashiCorp Vault | Defence in depth |

## 2. Repository Layout

A pnpm-workspace monorepo:

```
/apps
  /storefront         Next.js 14 SSR (App Router) — customer
  /admin              Next.js 14 SPA — admin console
  /accounting         Next.js 14 SPA — premium portal
  /api                Express + Mongoose REST API
  /worker             BullMQ workers (email, SMS, push, accounting, social)
  /webhook            Express service for inbound webhooks
/packages
  /design-system      Neumorphic component library + Storybook
  /ui-hooks           shared React hooks (useDebounce, useInView, useRBAC)
  /motion             Framer Motion variants + GSAP utilities
  /shared-types       TS types + Zod schemas shared across api/ui
  /sdk                Auto-generated TS SDK from OpenAPI
  /eslint-config
  /tsconfig
/infra
  /terraform          AWS / GCP IaC
  /k8s                Helm charts
  /docker             base images
/docs                 (this folder)
```

## 3. Architectural Style

The system is a layered, service-oriented monolith built around a single Express API process with extracted async workers. The choice of "modular monolith" over microservices is deliberate: the v1 team is 9–10 FTE and the operational overhead of a microservice mesh is not justified at this scale. The codebase is organised by domain (auth, social, commerce, inventory, accounting, billing) with strict module boundaries enforced via ESLint import rules, so a future split to microservices is mechanical when scale demands it.

Cross-cutting infrastructure is shared: a single Mongo cluster (with collection-level segregation), a single Redis, a single S3 bucket. The Premium Accounting module is gated by the entitlement layer, not deployed separately, but its data lives in dedicated collections with strict access policies.

## 4. Functional Requirements (Engineering)

The PRD enumerates FR-001 through FR-016. The engineering requirements map onto those as follows.

**Auth & Identity (FR-001).** JWT issued by `/auth/login`; access token TTL 15 minutes, refresh token TTL 7 days, refresh rotated on every use, refresh family revocation on suspected theft. Passwords stored with bcrypt cost 12. 2FA TOTP (RFC 6238) required for Super Admin and Admin; QR provisioning via `otpauth://` URL. OAuth 2.0 PKCE flow for Google and Facebook social login. Email OTP and SMS OTP are 6-digit, 10-min validity, single-use, rate-limited (1 per minute, 5 per hour per identifier).

**RBAC (FR-002).** Middleware reads `req.user.roles` from the JWT, expands to a permission set via cached role-permission mapping, and runs a guard like `require('orders.update')` on the route. Premium routes additionally call `requireEntitlement('accounting.ledger')` which checks the tenant's active subscription and feature gate. Deny-by-default; missing permission returns 403 with structured error code.

**Catalogue (FR-003).** Mongoose schemas for `products`, `productVariants`, `categories`, `brands`. Bulk CSV import via streamed parser to a BullMQ job; idempotent on SKU collision. Image upload pre-signs an S3 URL from the API; the client uploads direct-to-S3; the API records the resulting key.

**Search (FR-004).** MongoDB Atlas Search index on `products` collection across name, description, brand, category, attributes. Auto-suggest endpoint returns under 100ms p95. Facets computed via Atlas Search `$searchMeta`. Saved searches stored per user in `users.savedSearches`.

**Cart (FR-005).** Cart documents live in `carts` collection keyed by `userId` (for logged-in) or anonymous session token (for guests). Real-time stock validation runs on every quantity change via an atomic `findOneAndUpdate` against `inventory` collection. Guest cart merges on login via a server-side `mergeCart` action.

**Checkout (FR-006).** Five-step state machine implemented as a Mongoose document on `checkoutSessions` with `currentStep` enum. Coupon validation runs server-side; client never trusts client-side computed totals. Guest checkout permitted with email collection.

**Payment (FR-007).** Payment Orchestrator wraps each gateway behind a common `PaymentGateway` interface (`initiate`, `verify`, `refund`, `webhook`). Webhooks are idempotent — every payment provider event is keyed by provider event ID and stored in `paymentEvents`; re-delivery is a no-op. Failed payments hold the order in `Pending` for 24h with a retry link; abandoned-checkout email fires after 1h via BullMQ delay.

**Orders (FR-008).** State machine in `orders.status`; transitions enforced by a service-layer guard that rejects invalid edges. Every transition emits a domain event consumed by the notification worker, inventory worker, and accounting worker.

**Inventory (FR-009).** `inventory` collection holds `{ sku, onHand, reserved, available, threshold }`. Reservation on order create uses an atomic `findOneAndUpdate` with `$inc` guarded by `available >= qty`. Returns restock via the same atomic update in reverse. Low-stock alerts dispatched when `available <= threshold` on the post-update document.

**Notifications (FR-010).** Outbox pattern: domain events write to `notificationOutbox`; a BullMQ worker drains, dispatches via SendGrid/Twilio/Sparrow/FCM, and records delivery status. Per-channel opt-out respected before dispatch.

**Social Composer (FR-011).** Composer endpoint accepts a single payload + an array of target social accounts. The social worker fans out to per-platform formatters and publishes via Meta Graph or TikTok APIs. OAuth tokens stored encrypted with envelope encryption (KMS data key per tenant). Draft and approval workflow gated by RBAC.

**Inbox (FR-012).** Webhook ingest from Meta and TikTok writes to `inboxMessages` with thread linking. Assignment, SLA, and read receipts surface via Socket.IO.

**Accounting (FR-013).** Domain events (order paid, refund issued, payout reconciled, stock write-off, PO received) are consumed by the accounting worker which posts double-entry journal entries to `journalEntries` and `journalLines`. Posting is idempotent on source event ID.

**Tax (FR-014).** Tax engine computes per-line tax at cart/invoice time using current `taxRates` valid for the period and product/category mapping. VAT 200 and GSTR exports stream from `journalLines` aggregations. Nepal IRD e-invoice JSON is generated per invoice and stored alongside the PDF in S3.

**Audit (FR-015).** Mongoose middleware on every premium-scope mutation writes an `auditLog` entry with `{ actor, action, entity, entityId, beforeJson, afterJson, ip, ua, ts }`. Audit log writes use a separate Mongo replica with WORM mount (immutable storage class on object-store backed shards). Audit pack export bundles trial balance + GL + audit log + invoices into a ZIP signed with SHA-256.

**Subscription (FR-016).** Stripe Billing for international cards; eSewa and Khalti recurring for NPR. Webhook from each provider syncs `subscriptions.status` and `expires_at`. Dunning worker retries on day 1, 3, 7; downgrades on day 14. Entitlement cache invalidated on every subscription transition.

## 5. Non-Functional Requirements (Engineering)

**Performance.** p95 API latency under 300ms; p95 storefront LCP under 2.5s on 4G; auto-suggest under 100ms p95; checkout-to-paid round-trip under 2s p95. Achieved via: Mongo indexes designed per access pattern (see `Database.md`); Redis caching for hot reads (product cards, category trees, RBAC permission expansion); CDN cache headers on all storefront pages; Image CDN with WebP/AVIF auto-conversion.

**Scalability.** Stateless API behind a load balancer; horizontal autoscale based on CPU and request rate. Mongo Atlas tier sized for 50k MAU at launch with capacity to vertical-scale through M40 → M60. Redis cluster mode-ready (single-node v1, cluster-mode-enabled config). BullMQ workers scale horizontally per queue.

**Reliability.** 99.9% uptime SLO. Liveness and readiness probes on every service. Graceful shutdown drains in-flight requests for up to 30s. Background workers checkpoint on crash and resume idempotently.

**Security.** OWASP ASVS Level 2 target. TLS 1.3 in transit. AES-256 at rest. Secrets in Vault (or AWS Secrets Manager). PII fields (`email`, `phone`, `addresses`) encrypted with Mongo client-side field-level encryption (CSFLE) for fields requiring zero-knowledge guarantees. PCI scope minimised via Stripe Elements. WAF (Cloudflare or AWS) in front of the API gateway. See `04-security/Security-Requirements.md` for the full controls catalogue.

**Observability.** Structured JSON logs to Datadog. OpenTelemetry traces with W3C trace-context propagation. Per-route SLI dashboards with error budget burn alerts. Sentry for unhandled exceptions with source maps. Audit log queryable as a separate stream (not mixed into operational logs).

**Compliance.** GDPR-aligned consent capture, data export (downloadable ZIP), and right-to-deletion (soft-delete with anonymisation; PII fields nulled, audit log preserved). Nepal IRD VAT 200, e-invoice JSON. Indian GSTR-1 and GSTR-3B export. Multi-tenant data residency selectable on Enterprise plan.

**Accessibility.** WCAG 2.1 AA across all customer-facing pages and admin screens. Lighthouse a11y score ≥ 95 on the home, PLP, PDP, cart, checkout, profile, and orders pages. Automated axe-core checks in CI.

## 6. Browser & Device Support

Modern evergreen browsers: Chrome, Edge, Firefox, Safari latest two major versions. iOS Safari and Android Chrome current and current-minus-one. No IE11 support. PWA installable on Chrome, Edge, and iOS Safari (with documented quirks). Storefront responsive across 320px–2560px viewports.

## 7. Standards & Conventions

TypeScript strict mode everywhere; no `any` in shipped code without an `eslint-disable` comment explaining why. ESLint + Prettier with a shared config. Conventional Commits. Trunk-based development with short-lived feature branches; PRs require one approval, passing CI, and a green preview deploy. Test coverage gate: 80% statement coverage on `apps/api`, 75% on `apps/storefront` and `apps/admin`.

## 8. References

- System architecture: `03-technical/Architecture.md`
- Database schema: `03-technical/Database.md`
- API contract: `03-technical/API.md`
- Security: `04-security/Security-Requirements.md`
- DevOps: `05-devops/Infrastructure.md`
