# System Architecture

**Project:** Unified Marketing & E-Commerce Management Platform
**Stack:** MERN (MongoDB, Express, React/Next.js, Node.js)
**Version:** 1.0

---

## 1. Architectural Style

The platform is a **modular monolith** with extracted async workers and a thin webhook ingestion service. The single Express application is partitioned by domain — auth, social, commerce, inventory, order, crm, accounting, billing — each owning its own folder, models, services, controllers, and routes. Cross-module imports are restricted by ESLint rules: a module can import from `shared/` and from its own folder, but not directly from another domain module's internal code; cross-module communication goes through published interfaces. This boundary discipline keeps the codebase splittable into microservices later without an upfront operational tax.

Async work — emails, SMS, push, social publishing, accounting postings, dunning, scheduled posts — runs in BullMQ workers in a separate process so the API stays responsive under load. Inbound webhooks (payment, courier, social) hit a dedicated webhook service to isolate untrusted traffic and to provide a fast 2xx ACK before durable processing.

## 2. Six-Layer View

The platform is described in six layers, matching the architecture diagram in the Master Plan.

### 2.1 Client Layer

End customers reach the storefront from browsers (desktop, tablet, mobile) and the installable PWA. Admin team users (Super Admin, Admin, Editor) reach the admin console from desktop browsers. Accountants reach the premium portal (entitlement-gated). Viewers and stakeholders consume read-only dashboards. Couriers and payment providers call our webhook endpoints.

### 2.2 Presentation Layer (Next.js 14)

Three Next.js applications share the design system package and the SDK.

**Customer Storefront** runs Next.js 14 App Router with SSR for catalogue, PLP, PDP, and order tracking pages; ISR for cached marketing pages; CSR for cart and checkout. Tailwind CSS, Redux Toolkit + React Query, Framer Motion for UI motion, GSAP ScrollTrigger for scroll-driven sections, AOS for low-priority reveals, Motion One for micro-interactions, Spline for the hero 3D scene. Service worker provides offline cart cache and push.

**Admin Web Console** is a Next.js 14 SPA-style app (client-rendered after auth). Same design system. Role-aware layout: navigation, sidebar items, and route guards driven by the user's permission set.

**Accounting Portal (Premium)** is a separate route group inside the admin shell, entitlement-aware so locked features render an upgrade prompt instead of an error.

### 2.3 Application Layer (API & Services)

A single Express API behind an API Gateway (NGINX or AWS API Gateway / Cloudflare) that handles TLS termination, rate limiting, IP allow-listing for admin routes, and WebSocket upgrade. The API hosts:

- **Auth & Identity service** — registration, login, OTP, OAuth, 2FA, JWT issue/refresh.
- **RBAC Engine** — permission expansion, route guards, entitlement checks. Cached in Redis.
- **Subscription & Billing Engine** — plan management, dunning, entitlement publishing.
- **Domain services** — social, e-commerce, inventory, order state machine, CRM/messaging, accounting core (premium).

The Socket.IO gateway runs in the same process behind a sticky-session load balancer (or on a separate Redis-pubsub-backed cluster for horizontal scale).

A separate **Webhook Service** handles inbound provider callbacks (Stripe, eSewa, Khalti, PayPal, Pathao, Aramex, Meta, TikTok). It validates signatures, ACKs fast, and enqueues a BullMQ job for durable processing.

Workers (separate process) process queues for: email, SMS, push, social publishing, scheduled posts, accounting postings, dunning, audit log replication, search index sync.

### 2.4 Data Layer

**MongoDB (Atlas)** is the primary relational+document store. Collections are described in `Database.md`. Read replicas for analytics and reporting workloads; primary for OLTP. MongoDB transactions are used for cross-collection atomic operations (order create → inventory reserve → payment session) — Mongo 7 supports multi-document ACID transactions which are sufficient for this workload.

**Redis 7** holds sessions, cart cache, rate-limit counters, BullMQ queues, RBAC permission cache, entitlement cache, and Socket.IO pub/sub backplane.

**MongoDB Atlas Search** indexes the `products` collection for full-text and faceted search with sub-100ms response. A Meilisearch fallback is documented for self-hosted deployments.

**Object Storage (S3 / R2)** holds product images, social media assets, invoice PDFs, audit packs.

**Audit Logs DB** is a logically separate Mongo cluster (or a separate collection mounted on immutable storage) with append-only access policies and WORM-style backup to object storage.

### 2.5 External Integrations

Meta Graph API (Facebook + Instagram), TikTok Marketing API, eSewa, Khalti, Stripe / Stripe Billing, PayPal, SendGrid, Twilio, Sparrow SMS, Firebase Cloud Messaging, Pathao, Aramex, Nepal IRD e-invoice engine.

Each integration is encapsulated behind a service interface (`SocialProvider`, `PaymentGateway`, `Courier`, `EmailProvider`) so a swap-out is a matter of writing a new adapter, not refactoring callers. OAuth tokens are stored encrypted with envelope encryption (KMS data key per tenant).

### 2.6 Infrastructure Layer

AWS or GCP, deployed via Terraform. Kubernetes (EKS or GKE) for container orchestration. Cloudflare in front for WAF, DDoS, CDN. CloudFront / Cloud CDN for storefront edge caching. S3 / GCS for object storage. RDS-style managed Mongo (Atlas) and managed Redis (ElastiCache or Memorystore). GitHub Actions for CI; Terraform Cloud for IaC state. Sentry for errors, Datadog for APM and infra. HashiCorp Vault for secrets (or cloud-native Secrets Manager).

## 3. End-to-End Purchase Flow

A typical purchase moves through the system as follows.

1. **Sign in.** Customer registers or logs in on the storefront. The Auth service issues a JWT access token (15-min TTL) and a refresh token (7-day TTL, rotating).

2. **Browse.** Storefront SSR fetches catalogue pages from the API which reads from Mongo with Atlas Search facets. Hot products are cached in Redis. The Mega Menu category tree is cached for 5 minutes.

3. **Add to cart.** Cart updates write to `carts` keyed by user ID. Real-time stock validation runs an atomic update against `inventory`. Cart is persistent for logged-in users and migrates from a guest session token on login.

4. **Checkout.** The Order Service creates a Pending order; Inventory reserves stock atomically; the Payment Orchestrator initiates the chosen gateway (eSewa redirect, Khalti popup, Stripe Elements, or COD).

5. **Payment verification.** Payment provider callback hits the Webhook Service; signature verified; event enqueued. Worker verifies the payment, transitions the order to Confirmed via the State Machine, fires Email + SMS + Push via the notification outbox, and (for tenants with active Premium) posts a journal entry to the Accounting Core.

6. **Fulfilment.** Admin sees the order in real time via Socket.IO; assigns courier; courier webhook later pushes Out-for-Delivery and Delivered events; State Machine advances; notifications fire.

7. **Post-purchase.** Customer tracks live; can request a return inside the configured window; refund auto-routed to original wallet/card via the relevant API; State Machine transitions Returned → Refunded; Accounting posts the offsetting journal entry; Inventory restocks atomically.

Every cross-lane arrow is an authenticated, RBAC-checked API call. Every status change broadcasts via Socket.IO to relevant dashboards in real time. Every business event is appended to the immutable audit log. Premium-gated calls go through an entitlement check before executing.

## 4. Multi-Tenancy Model

v1 ships single-tenant (one platform deployment per customer organisation). The data model already carries a `tenantId` field on every collection that owns business data (so a future shared multi-tenant deployment is a configuration switch and a Mongo index addition rather than a schema migration). The Enterprise plan exposes a tenant-data-residency selector at deploy time that pins a tenant to a specific cloud region.

## 5. Real-Time Architecture

Socket.IO over WebSocket with sticky sessions at the load balancer (or a Redis pub/sub backplane for cluster mode). Channels: `tenant:{id}:orders`, `tenant:{id}:inbox`, `tenant:{id}:inventory`, `user:{id}:notifications`. Clients authenticate the socket with their JWT on `connect`; the server verifies and joins appropriate rooms. Reconnect with exponential backoff; client buffers events on disconnect and replays on reconnect via a `since` cursor.

## 6. Resilience & Failure Modes

**Payment gateway outage.** Orchestrator surfaces a "Try a different method" UI; failed orders held Pending for 24h with retry link; abandoned-checkout email after 1h.

**Social API outage.** Composer queues posts to the social worker which retries with exponential backoff up to 24h; surfaces a warning banner in the admin once a queue depth threshold is reached.

**Courier webhook silence.** Fallback poller calls the courier's tracking API every 2 hours if no webhook arrives.

**Mongo failover.** Atlas replica-set automatic failover; client driver retries on the new primary; in-flight transactions abort and surface a retryable error to the API consumer.

**Redis failure.** Cart, sessions, and rate limit degrade to Mongo reads; the API stays up but slower; circuit breaker on the BullMQ side prevents thundering-herd.

**Region outage.** Pilot DR plan: Atlas cross-region cluster snapshot, S3 cross-region replication, Terraform apply to spin up a DR region within RTO 4 hours.

## 7. Deployment Topology

Three environments: `development`, `staging`, `production`. Each runs the same Kubernetes manifests with environment-specific config and secrets. Production is a multi-AZ deployment in a single region for v1, with a documented DR procedure for failover to a second region. Storefront, admin, and accounting Next.js apps deploy as separate K8s Deployments with horizontal-pod-autoscaling. API and webhook deployments separate. Workers deployed per queue, scaled independently.

## 8. Diagram Reference

See the system architecture and end-to-end flow diagrams in the Master Plan PDF (Figures 1 and 2). A Mermaid version of both is maintained at `03-technical/diagrams/` and renders inline in this folder.
