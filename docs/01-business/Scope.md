# Project Scope Document

**Project:** Unified Marketing & E-Commerce Management Platform
**Version:** 1.0
**Date:** May 2026

---

## 1. Scope Statement

This document defines the boundary of the v1 release: what is included, what is explicitly excluded, what is deferred to a later release, and the assumptions and constraints that shape the boundary. Any work not listed here is by definition out of scope and must be raised through the change-control process described in Section 7.

## 2. In Scope (v1)

### 2.1 Functional Scope

The v1 release ships seven functional product areas. Authentication and identity covers email/password, phone OTP, Google/Facebook OAuth, 2FA TOTP, bcrypt password storage, and JWT with refresh-token rotation. RBAC covers six built-in roles (Super Admin, Admin, Editor, Accountant, Viewer, Auditor) plus unlimited custom roles composed from individual permissions, with deny-by-default middleware enforcement on every API route. The Social Media Hub covers Facebook, Instagram, and TikTok with unified composer, scheduler, inbox, analytics, media library, and approval workflow. The E-Commerce engine covers catalogue, variants, pricing/promotions, cart, checkout, eSewa/Khalti/Stripe/COD payments, invoice generation, returns, refunds, and CRM Lite. Order tracking and inventory covers the full order state machine, courier integration, stock movements, PO workflow, and notifications. The Customer Storefront covers homepage, PLP, PDP, search, profile, addresses, wishlist, orders, reviews, and support. The Premium Accounting module (subscription-gated) covers double-entry ledger, tax computation, reports, audit trail, bank reconciliation, and budgeting.

### 2.2 Technical Scope

Frontend: Next.js 14 with SSR for storefront, React SPA for admin/accounting consoles, Tailwind CSS, Redux Toolkit + React Query, Framer Motion, GSAP ScrollTrigger, AOS, Motion One, Spline, Neumorphism design system, PWA with offline cart and push notifications. Backend: Node.js + Express (MERN), MongoDB primary store, Redis cache and queue backplane, MongoDB Atlas Search for catalogue search. Real-time via Socket.IO. Object storage on S3. Infrastructure: AWS or GCP with EKS/GKE, CloudFront/Cloud CDN, Docker, Terraform, GitHub Actions CI/CD, Sentry + Datadog monitoring, WAF + TLS 1.3 + AES-256 security.

### 2.3 Integration Scope

Meta Graph API (Facebook + Instagram), TikTok Marketing API, eSewa, Khalti, Stripe (Cards + Billing), PayPal (cards fallback for international), SendGrid (email), Twilio + Sparrow SMS (SMS), Firebase Cloud Messaging (push), Pathao + Aramex (courier webhooks), Nepal IRD e-invoice engine.

### 2.4 Delivery Scope

Source code in a monorepo with documented build, lint, test, and deploy pipelines. Test suites covering unit, integration, e2e, performance, security, and accessibility (see `06-testing/Test-Plan.md`). Documentation across business, design, technical, security, devops, testing, monitoring, legal, and project-management folders. A third-party security audit pre-launch and UAT sign-off gate. Operational runbooks for incident response, on-call, and weekly metrics review.

## 3. Out of Scope (v1)

The following are explicitly out of scope for v1 and will not be built or accepted in this release.

Native iOS/Android applications are deferred to Year 2; v1 ships as a PWA only. A multi-vendor marketplace (multiple sellers per tenant with payout splits) is out of scope; v1 is strictly single-tenant. Physical POS hardware integration in retail stores is out of scope. B2B wholesale negotiated pricing tiers and tiered-customer pricing books are out of scope. Native ERP integrations (SAP, Oracle, NetSuite) are out of scope; data export to those systems is supported via CSV and the public API only. Headless storefront (separate frontend consuming the API) is out of scope; the storefront and admin console ship together. Multi-region active-active deployment is out of scope; v1 ships single-region with a documented DR region.

## 4. Deferred to Future Releases

The following are not in v1 but are on the roadmap. Native mobile apps (iOS and Android) are planned for Year 2. B2B wholesale portal with negotiated pricing tiers is a future enhancement. POS hardware integration is a future enhancement. Marketplace functionality (multi-vendor sellers with split payouts) is a future enhancement. Additional social channels beyond Meta and TikTok (LinkedIn, X, Pinterest, YouTube) are deferred pending demand signal.

## 5. Assumptions

Meta Business API and TikTok Marketing API developer access is granted within the typical 2–4 week window. eSewa and Khalti merchant accounts with sandbox credentials are issued within 1–2 weeks. Cloud provider region availability matches the target latency requirements for end customers. The Chartered Accountant engaged for Phase 6 discovery is available for the 4-week window before build start. The engineering team can be assembled to the staffing profile in Section 14 of the Master Plan. Customers will accept email and SMS for transactional notifications; WhatsApp Business integration is optional and may slip into post-launch backlog.

## 6. Constraints

Year-one budget envelope of approximately USD 605,000 inclusive of 15% contingency, or USD 250–350k if engineering is fully offshored to Nepal/India. Full-scope launch within 12 months wall-clock with overlapping teams. MVP launch (without Premium tier) within 9–10 months. Single-tenant only. PWA only in v1. Initial deployment to a single cloud region. PCI scope must be minimised — card data never touches our servers; Stripe Elements handles all card capture.

## 7. Change Control

Any addition to scope after this document is approved must go through the change-control process. Requests are filed as a Change Request (CR) with business justification, impact on schedule, impact on budget, and impact on risk. The Product Owner triages within 5 business days. Material CRs (above 1 sprint of effort or 5% of budget) require sign-off from the Project Sponsor. Approved CRs are reflected in updated versions of this document, the Roadmap, and the Sprint Plan. CRs that do not justify in-release inclusion are routed to the post-launch backlog.

## 8. Acceptance Criteria

The project is considered complete and the v1 release is considered shipped when: all functional requirements (FR-001 through FR-016 in the PRD) pass acceptance testing; the non-functional requirements in the PRD are demonstrably met under load; the third-party security audit returns no critical findings; UAT sign-off is received from the Product Owner and the Project Sponsor; the staging-to-production deployment runbook has been executed end-to-end at least once on a release-candidate build; monitoring and incident-response runbooks are operational; legal documents (Privacy Policy, Terms of Service) are published; and the team has completed at least one full DR drill.

## 9. Glossary

| Term | Definition |
|---|---|
| RBAC | Role-Based Access Control |
| MRR | Monthly Recurring Revenue |
| ARR | Annual Recurring Revenue |
| WORM | Write-Once-Read-Many storage |
| FCM | Firebase Cloud Messaging |
| PDP | Product Detail Page |
| PLP | Product Listing Page |
| PO | Purchase Order |
| IRD | Inland Revenue Department (Nepal) |
| SSR | Server-Side Rendering |
| PWA | Progressive Web Application |
| CoA | Chart of Accounts |
