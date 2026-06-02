# Roadmap

**Project:** Unified Marketing & E-Commerce Management Platform
**Total Duration:** ≈ 12 months wall-clock (overlapping teams)
**MVP (no Premium):** 9–10 months
**Version:** 1.0

---

## 1. Overview

The project ships in eight phases. Two work streams run in parallel from Phase 2 onward: the Internal Platform (Admin + Operations) and the Customer Portal (Storefront + Tracking). The Premium Accounting module is sequenced after the operational platform is stable so it can consume real transactional data. The final phase is a hard gate covering QA, third-party security audit, UAT, performance tuning, and launch.

Dates below are indicative and assume Phase 0 begins immediately after stakeholder sign-off. The team profile is in `09-project-management/Sprint-Plan.md`.

## 2. Phase Summary

| Phase | Scope | Duration | Milestone |
|---|---|---|---|
| Phase 0 | Sprint 0 — foundations | 2 weeks | Foundations Ready |
| Phase 1 | Identity, RBAC, Super Admin console | 8 weeks | Identity Layer |
| Phase 2 | Social Hub (Meta + TikTok) | 10 weeks | Marketing Hub |
| Phase 3 | E-Commerce engine + Customer Storefront + Payments | 12 weeks | Storefront Live |
| Phase 4 | Order Tracking + Inventory + Courier + CRM Lite | 8 weeks | Operations Engine |
| Phase 5 | Reporting, dashboards, analytics consolidation | 5 weeks | Intelligence Layer |
| Phase 6 | Premium Accounting + Tax + Audit + Subscription Billing | 10 weeks | Premium Tier |
| Phase 7 | QA, third-party security audit, UAT, perf tuning, launch | 5 weeks | Go-Live |

Sequential durations sum to 60 weeks; overlapping Phases 2/3/4 collapses wall-clock to ≈ 12 months.

## 3. Phase Detail

### Phase 0 — Sprint 0 (2 weeks)

Establish the team, the monorepo, CI/CD, environments, the design system seed, and the API skeleton. Outputs: repo with pnpm workspace, GitHub Actions CI, dev/staging environments stood up via Terraform, base Helm charts, Storybook initialised, OpenAPI scaffolding, design tokens defined, Figma library skeleton, on-call rota provisional. **Exit gate:** a hello-world API and storefront can be deployed end-to-end from a PR to staging within one click.

### Phase 1 — Identity & RBAC (8 weeks)

Build the foundation every other module depends on. Auth (email + password, phone + SMS OTP, Google + Facebook OAuth, 2FA TOTP); JWT issue + refresh rotation; bcrypt passwords; account-lockout. RBAC engine with role + permission model, deny-by-default middleware, role editor UI for Super Admins. User-management UI. Audit-log infrastructure. **Exit gate:** invite a user, assign roles, log in with 2FA, and confirm RBAC denies a forbidden action; all auth flows pass acceptance tests; audit log records every mutation.

### Phase 2 — Social Media Hub (10 weeks)

OAuth connect for Facebook, Instagram, TikTok. Unified composer with per-platform overrides. Scheduler with calendar view and best-time-to-post recommendations. Unified inbox aggregating comments, DMs, mentions with assignment and SLA tracking. Analytics dashboards. Media library on S3. Approval workflow gated by RBAC. **Exit gate:** publish a multi-channel post from one composer, reply to an inbox message in <2 minutes from event, run the analytics dashboard end-to-end.

### Phase 3 — E-Commerce + Storefront + Payments (12 weeks)

Product catalogue (CRUD, variants, categories, bulk CSV import). Pricing and promotions with coupon engine. Customer storefront with home, PLP, PDP, search, reviews, wishlist. Cart with persistent + guest. 5-step checkout. Payment integrations: eSewa, Khalti, Stripe (3DS2), PayPal, COD. Order confirmation and live tracking. SEO (SSR, JSON-LD, sitemap, OG). Hero with Spline + parallax; Neumorphic Design System fully wired. **Exit gate:** a customer can sign up, browse, search, add to cart, apply a coupon, check out via every payment method, and see their order in My Orders. Performance budget passes load test at 1,000 concurrent browse + 5,000 concurrent flash-sale checkout.

### Phase 4 — Order Tracking + Inventory + Courier + CRM Lite (8 weeks)

Order state machine with full lifecycle. Live stock per SKU + variant with reserved/available split. Stock adjustment with audit. PO workflow. Stock movement log. Courier registry + Pathao/Aramex webhooks. Customer order tracking page with stepper + scan timeline. Notification triggers (email + SMS + push) on every state change. CRM Lite (profile + history + tagging + segmentation). **Exit gate:** an order moves Pending → Confirmed → Processing → Shipped → Delivered → Returned with auto-restock, auto-refund, and auto-notification at every step.

### Phase 5 — Reporting, Dashboards, Analytics (5 weeks)

Consolidate cross-module analytics. Admin overview dashboard with KPI tiles. Per-module dashboards (social, sales, inventory, CRM). Exportable PDF/Excel reports. Scheduled email reports. **Exit gate:** a Viewer role can log in and see read-only dashboards across every module; an Admin can schedule a weekly email report.

### Phase 6 — Premium Accounting + Tax + Audit + Subscription (10 weeks)

A 4-week Chartered Accountant discovery precedes the build, locking chart of accounts, tax rules, and audit-pack format. Build the double-entry ledger with auto-journaling from platform events (order paid, refund, payout, stock write-off, PO receive) and manual journal entry UI. Tax Module with VAT 200, GSTR-1/3B, Nepal IRD e-invoice JSON. Reports (P&L, Balance Sheet, cash-flow, trial balance, GL, sub-ledger). Bank reconciliation. Budgeting and forecasting. Subscription & Billing Engine with Stripe Billing + eSewa/Khalti recurring; dunning workflow; entitlement gating across the API. Audit trail with WORM storage and signed audit-pack export. **Exit gate:** auto-posted entries balance for every event class; a CA signs off on the regulator-format outputs; the dunning workflow tested end-to-end; locked-feature upgrade prompts surface correctly.

### Phase 7 — QA, Security Audit, UAT, Launch (5 weeks)

Full regression sweep. Third-party penetration test with remediation. Round 3 UAT across personas. Performance tuning to budget. Final accessibility audit. DR drill. Documentation freeze. Status page and runbook readiness. Launch communications drafted. **Exit gate:** all Scope.md launch criteria met; production launch.

## 4. Dependencies

Phase 1 (Identity) must complete before any other module — every API depends on it. Phases 2, 3, and 4 can run with overlapping teams once Phase 1 is stable. Phase 5 needs at least one of Phase 2/3/4 in production-ready state to produce meaningful analytics. Phase 6 (Premium) reads from Phases 3 and 4 — start no earlier than Phase 3 finish. Phase 7 is a hard gate — no production traffic until security and UAT pass.

## 5. Schedule (Indicative Weeks)

```
Phase 0        ████ (W1–W2)
Phase 1        ████████████████ (W3–W10)
Phase 2                      ████████████████████ (W11–W20)
Phase 3                      ████████████████████████ (W11–W22)   [overlap]
Phase 4                                                ████████████████ (W23–W30)
Phase 5                                                                ██████████ (W31–W35)
Phase 6                                                  ████████████████████ (W36–W45)
Phase 7                                                                              ██████████ (W46–W50)
```

Total: ≈ 50 weeks calendar time with overlapping Phases 2/3/4 (vs 60 weeks sequential). The 12-month wall-clock figure in the Master Plan reflects the same overlap.

## 6. Milestones & Demos

Each milestone is demonstrated to the Project Sponsor at the end of its phase. The demo follows a fixed agenda: walk through the milestone's acceptance criteria, show the working software end-to-end, surface known issues and their planned resolution, present the next-phase plan. A milestone is not considered closed until the demo is accepted.

## 7. Risk-Adjusted Variants

**MVP (no Premium, no TikTok).** Phases 0, 1, 2 (Meta only), 3, 4, 5, 7. Total: ≈ 9–10 months. Reduces team cost by 25–30% per Master Plan §11.

**Fast-launch (sequential, no overlap).** Total: ≈ 14–15 months. Lower team utilisation but lower risk.

**Phased GA.** Launch with Phases 0–4 (operational platform) as a v0.9 beta; Phases 5–6 add post-launch. Allows revenue capture earlier; introduces complexity around upgrading customers in production.

The choice of variant is the Project Sponsor's at Phase 0 sign-off.

## 8. Post-Launch Roadmap (Indicative)

**v1.1 (Q1 post-launch).** Native iOS/Android apps. WhatsApp Business integration. Additional social channels (LinkedIn, X, Pinterest). Multi-currency at checkout.

**v1.2 (Q2 post-launch).** Hardware MFA (FIDO2/WebAuthn). Active-active multi-region deployment. DLP on accountant exports. Customer-facing API for enterprise tenants.

**v1.3 (Q3 post-launch).** B2B wholesale portal with negotiated pricing tiers. SOC 2 Type II readiness. Advanced budgeting (per-cost-centre with allocations).

**v1.4 (Q4 post-launch).** Multi-vendor marketplace functionality. POS hardware integration. Enterprise SSO (SAML, OIDC).

The post-launch roadmap is reviewed quarterly with the Project Sponsor based on customer feedback and market signal.
