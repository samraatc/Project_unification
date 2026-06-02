# Sprint Plan

**Project:** Unified Marketing & E-Commerce Management Platform
**Cadence:** 2-week sprints, Tuesday → Monday
**Methodology:** Scrum (lightweight), trunk-based dev, Conventional Commits
**Version:** 1.0

---

## 1. Team

| Role | Count | Phases Active | Notes |
|---|---|---|---|
| Project / Delivery Manager | 1 | All | Sprint facilitation, stakeholder comms |
| Backend Engineers | 2 | All | API, DB, RBAC, payments, accounting service |
| Frontend Engineers | 2 | All | Next.js storefront, admin console, accounting portal |
| Social API Specialist | 1 | Mostly 2 | Meta + TikTok integration |
| DevOps / Cloud Engineer | 1 | All | Infra, CI/CD, security, observability |
| UI / UX Designer | 1 | All | Design system, wireframes, user testing |
| QA Engineer | 1 | All | Test plans, automation, regression, UAT |
| Accounting Domain Specialist | 1 (6mo) | 6 | CoA, tax rules, audit pack |

Total 9–10 FTE for project duration; Accounting Specialist engaged for the Phase 6 window only.

## 2. Sprint Cadence

Sprints are two weeks, kicking off Tuesday morning with planning and closing the following Monday with review + retro. The standard sprint timeline is:

- **Sprint Planning (Tue, 90 min).** Refined backlog reviewed; team commits to a sprint goal and stories.
- **Daily Stand-up (15 min).** What's done, what's next, what's blocked.
- **Mid-sprint Refinement (Thu of week 1, 60 min).** Look ahead to next sprint; refine and estimate.
- **Sprint Review / Demo (Mon, 60 min).** Show working software to stakeholders.
- **Sprint Retro (Mon, 60 min).** What worked, what didn't, one experiment for next sprint.

## 3. Definition of Ready (DoR)

A story is ready for a sprint when it has: a clear user-story statement, testable acceptance criteria in Given-When-Then, a designed mock or wireframe if UI is involved, no unknown dependencies, an effort estimate, a Conventional Commits scope, and an assigned epic.

## 4. Definition of Done (DoD)

A story is done when: code is merged to `main` and deployed to staging; unit + integration tests cover the new behaviour; coverage has not regressed materially; OpenAPI and Storybook are updated where applicable; the acceptance criteria pass on staging; the QA Engineer has signed off; documentation is updated where the change affects a published doc.

## 5. Estimation

Stories are estimated in story points using Fibonacci (1, 2, 3, 5, 8, 13). Anything above 13 is broken down. Team velocity is tracked but not used as a target; we plan to confidence, not to a quota.

## 6. Per-Phase Sprint Outline

The following outline is indicative — the team adjusts at planning based on the prior sprint's velocity and emerging discoveries.

### Phase 0 — Sprint 0 (1 sprint × 2 weeks)

**Sprint goal:** repo, CI/CD, environments, design seed, hello-world end-to-end deploy.

Stories include: bootstrap monorepo with pnpm + Turborepo; set up GitHub Actions for typecheck, lint, test, build, security; provision dev + staging via Terraform; baseline Helm charts for `api`, `storefront`; initial Storybook + design tokens; OpenAPI scaffold; on-call rota provisional; status page provisional.

### Phase 1 — Identity & RBAC (4 sprints × 2 weeks)

**Sprint 1.1.** User model + Mongoose schemas; signup with email + bcrypt; email OTP verification.
**Sprint 1.2.** Phone OTP signup; password reset; account lockout; rate limiting.
**Sprint 1.3.** Google + Facebook OAuth (PKCE); 2FA TOTP enrolment and verify; backup codes.
**Sprint 1.4.** RBAC engine: role + permission model; deny-by-default middleware; role editor UI; user-management UI; audit-log infrastructure.

### Phase 2 — Social Media Hub (5 sprints × 2 weeks)

**Sprint 2.1.** OAuth connect Facebook + Instagram + TikTok; encrypted token storage; account connection UI.
**Sprint 2.2.** Unified composer with per-platform overrides; media uploader (S3); draft save.
**Sprint 2.3.** Scheduler (calendar UI); BullMQ scheduled-publish worker; per-platform publish formatters.
**Sprint 2.4.** Unified inbox (webhook ingest from Meta and TikTok); thread linking; assignment; SLA timer.
**Sprint 2.5.** Analytics dashboard; media library tagging + search; approval workflow gated by RBAC.

### Phase 3 — E-Commerce + Storefront + Payments (6 sprints × 2 weeks)

**Sprint 3.1.** Product catalogue CRUD; variant tree; category hierarchy; bulk CSV import job.
**Sprint 3.2.** Pricing + promotions; coupon engine; tax-class plumbing (not full tax — Premium); storefront PLP with filters and sort.
**Sprint 3.3.** PDP with image gallery + variant picker; search (Atlas Search) with autocomplete; reviews + wishlist.
**Sprint 3.4.** Cart (persistent + guest); 5-step checkout (Address, Delivery, Review, Payment, Confirmation); coupon UI.
**Sprint 3.5.** Payment integrations: eSewa, Khalti, Stripe 3DS2; webhook verification; idempotency; abandoned-checkout flow.
**Sprint 3.6.** PayPal + COD; invoice PDF generation; Hero with Spline + parallax; Neumorphic polish across storefront; performance pass.

### Phase 4 — Order Tracking + Inventory + Courier + CRM Lite (4 sprints × 2 weeks)

**Sprint 4.1.** Order state machine; status history; inventory model with reserved/available split; atomic reserve/restock.
**Sprint 4.2.** Stock adjustment + reasons + audit; low-stock alerts; PO workflow.
**Sprint 4.3.** Courier registry + Pathao + Aramex webhook ingest; tracking link generation; customer tracking page with stepper + scan timeline.
**Sprint 4.4.** Notification outbox + worker for email + SMS + push; CRM Lite (profiles, segments, communication log, tagging).

### Phase 5 — Reporting & Dashboards (2 sprints × 2 weeks + 1-week buffer)

**Sprint 5.1.** Admin overview dashboard; per-module dashboards (social, sales, inventory, CRM); KPI tiles.
**Sprint 5.2.** Exportable PDF/Excel reports; scheduled email reports; Viewer-role polish.

### Phase 6 — Premium Accounting + Subscription (5 sprints × 2 weeks)

(Preceded by a 4-week CA discovery executed in parallel during Phase 4.)

**Sprint 6.1.** Subscription & Billing Engine; Stripe Billing + eSewa/Khalti recurring; entitlement gates.
**Sprint 6.2.** Chart of Accounts (templates: Retail, Services, Manufacturing); manual journal entry UI; auto-journal from order paid + refund events.
**Sprint 6.3.** Auto-journal from payout, stock write-off, PO receive; multi-currency with FX; period close.
**Sprint 6.4.** Tax Module: VAT 200, GSTR-1, GSTR-3B, Nepal IRD e-invoice JSON.
**Sprint 6.5.** P&L, Balance Sheet, cash-flow, trial balance, GL, sub-ledger; bank reconciliation; budgeting; audit trail + WORM + signed audit pack export.

### Phase 7 — QA, Security, UAT, Launch (2 sprints × 2 weeks + 1-week buffer)

**Sprint 7.1.** Third-party pen test in flight; full regression sweep; performance tuning; Round 3 UAT; accessibility audit; DR drill.
**Sprint 7.2.** Pen-test remediation; UAT sign-off; launch communications; status page final; on-call rota and runbook final.
**Launch week.** Pre-launch checklist; production cut-over via canary; first 72 hours hyper-care.

## 7. Backlog Management

The backlog is owned by the Product Owner and groomed weekly. Top-of-backlog items are refined to "Ready" two sprints in advance. The PM keeps the burndown and rate-of-change visible at every review.

The post-launch backlog is opened at Phase 6 and receives every change-request that does not justify in-release inclusion. After launch, the post-launch backlog feeds v1.1 and beyond per `Roadmap.md` §8.

## 8. Communication

The team operates async-first inside its sprint. Channels: `#dev` (general), `#dev-fe`, `#dev-be`, `#design`, `#qa`, `#devops`, `#incidents`, `#releases`. The PM publishes a one-page weekly status to the Project Sponsor every Friday covering: sprint goal status, key wins, blockers escalated, risks moved, next-week focus, KPI snapshot.

## 9. Tooling

- Issue tracking: Linear or Jira.
- Docs: Notion or Confluence; spec-of-record lives in this `docs/` folder.
- Diagrams: Excalidraw + Mermaid in `docs/03-technical/diagrams/`.
- Design: Figma (single shared library for the Neumorphic system).
- Code review: GitHub PRs with one approval + green CI.
- CI: GitHub Actions.
- Comms: Slack + Google Calendar.

## 10. Risk-Tracking in the Sprint

Each sprint review surfaces any new risk discovered. The PM updates `Risk-Register.md` and adjusts mitigation plans. A risk that has materialised into a blocker is escalated to the Project Sponsor within 24 hours.

## 11. Velocity & Capacity

The team commits to a sprint based on capacity (available person-days minus on-call, leave, ceremony overhead) and confidence in scope. We do not chase velocity. Velocity is reported as a trend, not a target.

## 12. Sprint Health Signals

A sprint is healthy when the team finishes what it committed to (target 80–90%), regression escapes are near zero, on-call burden is balanced, and the team's retro produces concrete next-sprint adjustments rather than the same complaints recurring. The PM watches these and surfaces leading indicators to the team.
