# Business Requirements Document (BRD)

**Project:** Unified Marketing & E-Commerce Management Platform
**Client:** Elskov Services
**Version:** 1.0
**Date:** May 2026
**Status:** Approved for Development

---

## 1. Executive Summary

The Unified Marketing & E-Commerce Management Platform is a single, role-controlled web application that consolidates five enterprise capabilities into one product: centralised social media management, a full e-commerce engine, end-to-end order tracking with inventory, granular RBAC, and a premium subscription-gated Accounting/Tax/Audit module.

The platform replaces 5–7 separate SaaS subscriptions a typical SMB stitches together (social scheduler, inbox tool, storefront, order/inventory app, accounting system) and eliminates duplicate data entry, integration drift, and reporting fragmentation.

## 2. Business Drivers

The business is investing in this platform for four reasons. First, operational consolidation: clients today juggle disparate tools that do not share an identity layer or data model, causing data desynchronisation and manual reconciliation work. Second, recurring revenue: the premium Accounting tier creates an MRR/ARR stream priced against existing budget allocations to Tally, QuickBooks, Xero, and Zoho. Third, compliance: regulator-ready VAT/GST returns and immutable audit trails are a high-value capability competitors charge separately for. Fourth, market position: a single-vendor, single-login solution with shared RBAC differentiates against modular SaaS stacks.

## 3. Business Objectives

The platform must eliminate tool fragmentation by collapsing social, commerce, fulfilment, and finance into one product; increase team productivity through role-based workspaces that surface only what each user needs; enable data-driven decisions through unified analytics across channels, sales, inventory turnover, and finance; open a recurring-revenue stream via the subscription-gated Accounting module; ensure security and compliance with GDPR-aligned data handling, immutable audit logging, and enforced RBAC; and scale gracefully to multi-warehouse, multi-currency, and additional social channels without re-architecture.

## 4. Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| Project Sponsor | Elskov Services Executive | Budget approval, strategic alignment, ROI |
| Product Owner | Internal PO | Backlog ownership, acceptance criteria |
| End Customers | Storefront shoppers | Frictionless browsing, payment, tracking |
| Admin Team | Super Admin, Admin, Editor | Daily operational tooling |
| Accountant | Finance staff | Premium Accounting module, regulator returns |
| Viewer / Stakeholder | Executives, investors | Read-only dashboards |
| Couriers & Suppliers | Pathao, Aramex | Webhook callbacks for status sync |
| Regulator | Nepal IRD, foreign tax authorities | VAT/GST returns, e-invoice JSON |

## 5. Business Capabilities

The platform delivers six business capabilities. Centralised social media control unifies posting, scheduling, and inbox management for Facebook, Instagram, and TikTok. The e-commerce engine provides catalogue, cart, checkout, multi-gateway payments (eSewa, Khalti, Stripe card, COD), and customer self-service. Order and inventory management auto-deducts stock on sale, auto-restocks on return, and auto-notifies on status change. RBAC supports Super Admin, Admin, Editor, Accountant, Viewer, and unlimited custom roles. The premium Accounting & Audit module unlocks double-entry ledger, VAT/GST computation, immutable audit trail, and regulator-ready reports via monthly, yearly, or lifetime subscription. Cross-cutting analytics surface KPIs across marketing, sales, fulfilment, and finance.

## 6. Success Criteria

Year-one success is measured against four KPI families. Operational: order processing time under 4 hours from payment to dispatch, cart-to-checkout conversion above 35%, checkout-to-paid conversion above 75%. Commercial: free-trial-to-paid conversion at or above 20%, MRR target of USD 25k by month 6 post-launch, monthly churn under 4%, net revenue retention above 105%. Technical: platform uptime 99.9% monthly, p95 API latency under 300ms, zero critical security incidents in the first 12 months. Marketing: time saved per week on social management of 40% or more vs manual tool switching, social engagement uplift of 20% within 90 days post-launch.

## 7. Business Constraints

The platform must launch within 12 months for full scope and 9–10 months without the Premium tier. Year-one Year-1 budget is approximately USD 605,000 inclusive of 15% contingency. Off-shoring engineering to Nepal/India can reduce this into the USD 250–350k range. The platform is single-tenant in this release (multi-vendor marketplace deferred). Native mobile apps are deferred to Year 2; the first release is PWA-only. Physical POS integration and B2B wholesale pricing tiers are out of scope for v1.

## 8. Business Risks

The key business risks are summarised below; the full Risk Register is maintained in `09-project-management/Risk-Register.md`.

Social API policy or pricing changes from Meta or TikTok carry medium likelihood and high impact; mitigation is an abstraction layer in code and a documented swap-out path. Scope creep delaying launch is high likelihood, medium impact; mitigation is strict change-control with post-launch backlog routing and signed-off scope per phase. Accounting module accuracy issues are medium likelihood, high impact; mitigation includes hiring a domain specialist, double-entry test fixtures, reconciliation tooling, and an independent CA review before pricing as a paid product. Premium subscription churn is medium/medium; mitigation includes strong onboarding, in-app NPS, scheduled health-check emails, and export-on-cancel to reduce lock-in fear.

## 9. Assumptions

The plan assumes Meta Business API and TikTok Marketing API access is granted within the 2–4 week typical window; eSewa and Khalti merchant accounts with sandbox credentials are issued within 1–2 weeks; the chosen cloud provider (AWS or GCP) supports the required regions; a Chartered Accountant is engaged for a 4-week discovery before Phase 6 to lock chart of accounts, tax rules, and audit pack format; and that the engineering team can be assembled to the staffing profile in Section 14 of the Master Plan.

## 10. Dependencies

External dependencies include Meta Graph API and TikTok Marketing API developer access, eSewa and Khalti merchant approvals, Stripe Connect activation in target jurisdictions, courier partner API credentials (Pathao, Aramex), SendGrid/Twilio/Sparrow SMS accounts, and IRD/GST engine integration. Internal dependencies include the design system being completed before Phase 2 starts, RBAC being shipped in Phase 1 because every downstream module relies on it, and the operational platform (Phases 3 and 4) reaching production before Phase 6 Premium build begins.

## 11. Approval

| Name | Role | Signature | Date |
|---|---|---|---|
| | Project Sponsor | | |
| | Product Owner | | |
| | Technical Lead | | |
| | Finance | | |
