# Product Requirements Document (PRD)

**Product:** Unified Marketing & E-Commerce Management Platform
**Stack:** MERN (MongoDB, Express, React, Node.js) + Next.js 14
**Version:** 1.0
**Owner:** Product Team — Elskov Services

---

## 1. Product Vision

One login, one product, one source of truth for marketing, sales, fulfilment, and finance. The platform replaces the typical SMB SaaS stack (social scheduler + inbox + storefront + inventory + accounting) with an integrated, role-aware, subscription-extensible application. Every business event — a post, a sale, a refund, a stock adjustment — flows through a shared identity layer and event bus, eliminating reconciliation work and producing a regulator-ready audit trail by default.

## 2. Target Users & Personas

**End Customer (Shopper).** Browses on mobile and desktop; expects a fast PWA storefront, OAuth signup, persistent cart, multi-gateway checkout (eSewa, Khalti, card, COD), live order tracking, and self-service returns.

**Super Admin.** Owns system configuration, billing, RBAC roles, and the audit log. The only role allowed to manage other Super Admins, change system settings, and configure Stripe Connect.

**Admin.** Daily operations: social campaigns, catalogue, orders, inventory, CRM, analytics, user management for non-admin roles. Cannot modify Super Admins or system configuration.

**Editor.** Content and catalogue staff: publishes posts, edits products, updates order status. No finance or user-management access.

**Accountant.** Finance focus: revenue, invoices, payouts, reconciliation, exports. Gateway to the Premium Accounting module when the tenant has an active subscription.

**Viewer / Stakeholder.** Read-only dashboards for investors, executives, juniors.

## 3. Modules & Features

### 3.1 Social Media Management Hub

A single control panel for Facebook, Instagram, and TikTok built on the official business APIs. The Unified Post Composer creates one post and publishes simultaneously to all connected channels with platform-specific overrides for caption length, hashtags, and media dimensions. The Content Scheduler is a calendar view with best-time-to-post recommendations from historical engagement, draft saving, and an approval workflow before publish. The Unified Inbox aggregates comments, DMs, and mentions into one queue with in-platform reply, teammate assignment, and SLA tracking. The Analytics Dashboard reports follower growth, reach, impressions, engagement rate per channel, and exportable PDF/Excel comparisons. A Media Library backed by S3 stores assets with tags, search, and re-use. The Approval Workflow can require Admin sign-off before publishing, enforced via RBAC.

### 3.2 E-Commerce Engine

The Product Catalogue Manager supports CRUD, image management, variant trees (size/colour/material), category hierarchies, and bulk CSV import. Pricing & Promotions covers base price, discount, scheduled sales, and a coupon engine (percentage, flat, free-ship, BOGO) with customer-segment targeting. Order Management offers a unified view, filter, and process workflow with full status transitions (Pending → Confirmed → Processing → Shipped → Delivered → Returned). Payments & Invoicing covers eSewa, Khalti, Stripe, and COD with auto-generated PDF invoices, refund processing, and dispute notes. The CRM Lite layer includes profile, order history, communication log, tagging, and segmentation. Storefront SEO is delivered via SSR, JSON-LD structured data, sitemap/robots.txt management, and Open Graph metadata.

### 3.3 Customer Portal (Storefront)

**Registration & Profile.** Email + password with email OTP, phone + SMS OTP, or social login via Google/Facebook OAuth 2.0. Profile fields include name, email, phone, password (bcrypt), avatar, DOB, gender, up to 5 labelled addresses, default address, linked eSewa/Khalti wallets, notification preferences, wishlist, order history, and GDPR-compliant data export and account deletion.

**Browsing & Discovery.** Homepage with hero carousel (Spline 3D effect), category grid, featured/trending/flash-sale sections, recently-viewed products. PLP supports grid/list toggle, sort (newest, price, popularity, rating), filter sidebar (category, brand, price slider, star rating, in-stock, discount band), and infinite scroll or pagination. PDP includes image gallery with zoom, variant selector with live stock check, tabbed description/specs/reviews/Q&A, delivery ETA by pin code, and frequently-bought-together suggestions. Global search uses MongoDB Atlas Search (or Elasticsearch/Meilisearch) with auto-suggest and saved search history.

**Cart, Checkout, Payment.** Persistent cart for logged-in users; guest cart auto-migrates on login; real-time stock validation. Coupon and loyalty-points engine with instant validation. Five-step checkout: Address → Delivery Method → Review → Payment → Confirmation, with guest checkout supported. Payment options: eSewa signed redirect, Khalti popup + Lookup API, Visa/MasterCard via Stripe with 3-D Secure 2, COD. Payment failure handling holds order in Pending for 24h with retry link, alternative-method suggestion, and abandoned-checkout email after 1h.

**Post-Purchase.** My Orders dashboard with active highlights, full history, reorder, invoice download. Live tracking with visual status stepper, courier scan timeline, dynamic ETA, and map view where the courier supports GPS. Guest tracking at `/track` using Order ID + email/phone. Verified reviews with helpful-vote and photo/video upload. Returns within a configurable window (default 7 days) with reason and photo; refunds auto-routed to the original wallet/card via the relevant API. Support via live chat widget, searchable Help Centre, and order-scoped ticketing.

### 3.4 Order Tracking & Inventory Management

**Admin Order Operations.** Orders dashboard with summary tiles (Today, Pending Payments, To Dispatch, Returns Pending) and a full table with filters and search. Order detail panel: customer info, line items, pricing breakdown, address, payment info, status history, internal notes, action buttons. Bulk operations: status update, courier assign, invoice/label print. Courier registry with auto-tracking-link generation and optional Pathao/Aramex webhook ingestion for fully automated status updates.

**Inventory Management.** Live stock per SKU and variant with reserved-vs-available split. Stock adjustment with reason and audit trail. Low-stock alerts via dashboard banner, email, SMS. Out-of-stock handling with customer Notify Me and auto-restock notifications. Bulk CSV import; barcode/QR intake via optional mobile companion. PO workflow: Draft → Sent → Partially Received → Fully Received. Stock movement log capturing every in/out event with type, qty, balance, user, reference (order ID or PO ID), filterable and exportable.

**Notifications.** Email + SMS + Push fire automatically on each business event with per-channel opt-out in the profile. Admin-only events (low stock, payment failure spike) route to the admin dashboard and an internal email list.

### 3.5 RBAC

Six built-in roles (Super Admin, Admin, Editor, Accountant, Viewer, Auditor) plus unlimited custom roles composed from individual permissions. Every API route is guarded by middleware that checks the caller's role and permission set. See `01-business/Scope.md` and `03-technical/TRD.md` for the full permission matrix.

### 3.6 Premium Accounting, Tax & Audit (Subscription-Gated)

A double-entry accounting suite with configurable Chart of Accounts (pre-loaded Retail, Services, Manufacturing templates), auto-generated journal entries from platform events (order, refund, payout, stock write-off, PO receipt), manual journal entry for adjustments, multi-currency with daily FX, and period close (monthly/quarterly/yearly) with locking and reopening controls. The Tax Module supports VAT/GST configuration per product or category, inclusive/exclusive pricing, exemptions, zero-rated items, VAT 200 / GST returns in regulator-ready format, Nepal IRD e-invoice JSON export, withholding-tax on supplier payouts, and tax-jurisdiction routing. Reports include P&L, Balance Sheet, cash-flow, trial balance, GL, sub-ledger drill-down, aged receivables/payables, inventory valuation (FIFO, weighted average). Audit Trail is immutable, append-only, WORM-style, with cryptographically signed audit pack export. Bank reconciliation supports CSV/OFX/API import with a confidence-scored auto-match engine. Budgeting & Forecasting covers annual budgets per cost centre, variance reports, and cash-flow forecasts.

### 3.7 Subscription Plans

| Plan | Billing | Indicative Price | Best For |
|---|---|---|---|
| Free Trial | 14 days | USD 0 | Evaluation, 100 transactions cap |
| Monthly | Per month | USD 29 / NPR 3,900 | Small business, 1 user |
| Yearly | Per year | USD 290 / NPR 39,000 (≈17% saving) | Growing SMB, 3 users, includes Tax Module |
| Lifetime | One-off | USD 1,499 / NPR 199,000 | Long-term commit, v1 bound |
| Enterprise | Custom | Contact sales | Multi-entity / multi-currency, SSO, on-prem |

Feature gating logic: every accounting API checks authenticated user → RBAC → tenant entitlement. UI components render conditionally on entitlement; locked features show an upgrade prompt rather than an error. Grace period of 7 days on expiry with read-only access; data archived after 14 days with export available on reactivation.

## 4. UX / UI Principles

The product applies modern motion-driven design throughout. Surfaces use **Neumorphism** for primary cards and interactive controls with soft inner/outer shadows. Page and component transitions use **Framer Motion** with `motion.div` and `initial`, `animate`, `exit`, `transition` props; layout animations use `layoutId` for shared-element transitions; gesture-driven interactions use `whileHover`, `whileTap`, `whileDrag`; staggered children via `staggerChildren` variants; page transitions wrapped in `AnimatePresence`. Scroll-driven storytelling combines the **Intersection Observer API**, **GSAP ScrollTrigger** for timeline scrubbing, **AOS** for class-based reveals on simple sections, and **Motion One** for lightweight stagger micro-interactions. The hero section features **Parallax Scrolling** and an interactive **Spline** 3D scene. Navigation uses a **Collapsible Sidebar**, **Mega Menu** for catalogue, and a **Floating/Sticky Header**. Overlays use **Dialog/Modal**, **Popover/Tooltip**, and **Toast Notifications**. Loading states are handled by **Skeleton Loaders**. Scroll-pinned **Sticky Sections** drive narrative pages (About, Pricing). See `02-design/Design-System.md` for tokens, component API, and motion contracts.

## 5. Functional Requirements (Numbered)

The numbering below is used by the Test Plan, Sprint Plan, and Acceptance Criteria.

- **FR-001 Auth.** Email/password, phone OTP, Google/Facebook OAuth; bcrypt password hashing; JWT 15-min access + 7-day refresh; 2FA TOTP required for Super Admin and Admin.
- **FR-002 RBAC.** Per-route middleware; role + permission check; entitlement check for premium routes; deny-by-default.
- **FR-003 Catalogue.** Product CRUD, variants, categories, bulk CSV import, image upload to S3.
- **FR-004 Search.** Auto-suggest under 100ms p95; faceted filters; saved searches for logged-in users.
- **FR-005 Cart.** Persistent cart per user; guest cart merge on login; real-time stock validation.
- **FR-006 Checkout.** 5-step flow; coupon validation; guest checkout supported.
- **FR-007 Payment.** eSewa, Khalti, Stripe 3DS2, COD; idempotent webhook handlers; failure retry within 24h.
- **FR-008 Orders.** State machine: Pending → Confirmed → Processing → Shipped → Delivered → Returned.
- **FR-009 Inventory.** On-hand, reserved, available tracking; atomic reserve on order; restock on return.
- **FR-010 Notifications.** Email + SMS + Push on every state change; per-channel opt-out.
- **FR-011 Social Composer.** One-to-many publish; per-platform override; draft + approval workflow.
- **FR-012 Inbox.** Aggregated comments + DMs + mentions; assign to user; SLA tracking.
- **FR-013 Accounting (Premium).** Auto-journal from order, refund, payout, stock write-off, PO receipt.
- **FR-014 Tax (Premium).** VAT/GST computation; VAT 200 / GST returns; IRD e-invoice JSON.
- **FR-015 Audit.** Immutable append-only log; WORM storage; signed audit pack export.
- **FR-016 Subscription.** Stripe Billing + eSewa/Khalti recurring; dunning on day 1, 3, 7; downgrade on day 14.

## 6. Non-Functional Requirements

Uptime 99.9% monthly. p95 API latency under 300ms. p95 storefront LCP under 2.5s on 4G. Auto-scaling to handle 10× baseline during flash-sales. Disaster recovery: daily snapshots, RPO under 1 hour, RTO under 4 hours. All PII encrypted at rest with AES-256; TLS 1.3 in transit. GDPR-aligned consent, export, delete flows. PCI scope minimised via Stripe Elements; no card data on our servers. WCAG 2.1 AA accessibility on all customer-facing pages.

## 7. Out of Scope (v1)

Native iOS/Android apps (deferred to Year 2 — PWA only in v1). Multi-vendor marketplace functionality (single-tenant only). Physical POS hardware integration. B2B wholesale negotiated pricing tiers.

## 8. Release Plan

See `09-project-management/Roadmap.md` for the full phased plan. Summary: Phase 0 foundations (2w) → Phase 1 Identity & RBAC (8w) → Phase 2 Social Hub (10w) → Phase 3 E-Commerce + Storefront (12w) → Phase 4 Order/Inventory/CRM (8w) → Phase 5 Analytics (5w) → Phase 6 Premium Accounting (10w) → Phase 7 QA + Security + UAT + Launch (5w). Phases 2–4 run with overlapping teams once Phase 1 is stable.
