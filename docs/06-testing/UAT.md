# User Acceptance Testing (UAT)

**Project:** Unified Marketing & E-Commerce Management Platform
**Version:** 1.0

---

## 1. UAT Objective

UAT confirms that the platform meets business requirements as understood by the people who will use it day-to-day, in conditions that mirror real-world usage. UAT is not a re-run of QA's regression suite. It is a structured exposure of the platform to representative users with a fixed scope, fixed exit criteria, and a documented sign-off.

A passed UAT is one of the hard gates for production launch (see `01-business/Scope.md` §8).

## 2. UAT Strategy

UAT runs in three rounds. Each round has a specific persona pool, scope, and duration. Rounds may overlap if scope allows.

**Round 1 — Operational UAT (2 weeks, Phases 1–4).** Internal admin team (Super Admin, Admin, Editor, Viewer) and a small panel of friendly customer testers. Scope: identity, RBAC, catalogue, orders, inventory, social, storefront browsing and checkout.

**Round 2 — Premium UAT (2 weeks, Phase 6).** Chartered Accountant, an existing customer's accountant if available, internal Accountant role tester. Scope: the entire Premium Accounting module — chart of accounts, journals, tax returns, audit pack, bank reconciliation, budgeting.

**Round 3 — Final UAT (1 week, Phase 7).** Cross-functional final pass with stakeholders representing every persona, on the production-candidate build, with real (sandbox) integrations. Scope: end-to-end customer journey + admin journey + accountant journey.

## 3. Participants

| Round | Persona | Source | Count |
|---|---|---|---|
| 1 | Super Admin | Internal | 1 |
| 1 | Admin | Internal | 2 |
| 1 | Editor | Internal | 2 |
| 1 | Viewer | Internal | 1 |
| 1 | Customer | Friends & family panel | 8 |
| 2 | Accountant | External CA | 1 |
| 2 | Accountant (customer's) | Optional, if available | 1 |
| 2 | Accountant role tester | Internal finance | 1 |
| 3 | All | Mixed | 12 |

Each participant is briefed in advance with: a one-pager explaining UAT, their persona, their scope, their access credentials, the test scenarios assigned to them, the feedback channel.

## 4. Test Scenarios

Scenarios are written as business journeys, not test cases. A participant follows the journey end-to-end and reports issues at each step. Scenarios cover at least: registration and login, profile and address management, browsing and search, PDP and reviews, cart and coupon, checkout via every payment method, order tracking, returns and refunds, profile data export and deletion (Round 1 customer).

Admin scenarios cover: invite a user and assign a role, create a custom role, schedule and publish a multi-channel post, respond to an inbox message, bulk import products, process an order, assign a courier, handle a return, run a sales report.

Accountant scenarios cover: configure chart of accounts from a template, post a manual journal, reverse a posted entry, view auto-posted entries for the day, run P&L, run balance sheet, generate VAT 200, generate Nepal IRD e-invoice JSON, reconcile a bank statement, export an audit pack, set a budget and view variance.

## 5. UAT Environment

UAT runs on a dedicated UAT environment that is a clone of staging, with synthetic but realistic data. Payment integrations use sandbox credentials. Email and SMS notifications route to a UAT-only inbox visible to participants. The environment is reset to a known-good seed at the start of each round.

Each participant receives unique credentials. Audit logging captures every UAT participant's actions for traceability.

## 6. Defect Reporting & Triage

Participants report defects via a shared form (Linear / Jira) with: scenario step, expected vs actual, screenshots or screen recording, browser/device, timestamp. The QA Engineer triages within one business day, assigning severity (S1–S4) and routing to the relevant engineer.

The UAT team holds a daily 15-minute defect-triage stand-up during each round to keep the queue moving. End-of-round, the QA Engineer publishes a UAT report summarising defects opened, closed, and outstanding.

## 7. Exit Criteria

A UAT round is considered passed when:

- All S1 defects are closed.
- All S2 defects are closed or have an approved workaround documented and accepted by the Product Owner.
- At least 80% of S3 defects are closed; the remainder must be on the backlog with an owner and target sprint.
- S4 defects do not gate exit.
- Each participant has signed off on their assigned scenarios (or has documented their objections, which the PO either accepts or addresses).

Production launch is gated on Round 3 passing.

## 8. Sign-Off

The UAT sign-off form is signed by:

- The Project Sponsor — confirming UAT was meaningful and the platform is fit for purpose.
- The Product Owner — confirming acceptance criteria for every in-scope FR are met.
- The QA Engineer — confirming exit criteria are met.
- A participant representative per persona — confirming the persona's experience is acceptable.

The signed form is filed alongside the release artefacts.

## 9. UAT Schedule (Indicative)

| Round | Window | Trigger |
|---|---|---|
| 1 | Weeks 38–39 (end of Phase 4) | Operations Engine milestone |
| 2 | Weeks 50–51 (end of Phase 6) | Premium Tier milestone |
| 3 | Weeks 56 (Phase 7) | Pre-launch gate |

Dates align with the Roadmap (`09-project-management/Roadmap.md`).

## 10. Lessons Learned

After each round, the QA Engineer facilitates a 60-minute retrospective with the participant pool and the development team. The output is a short list of process improvements applied in the next round (e.g., richer briefing, clearer scenarios, better instrumentation for screen recording).

## 11. Risk Notes

UAT risks include participant unavailability — mitigated by booking time slots in advance and over-recruiting by 20%; unrepresentative participants — mitigated by deliberately recruiting across persona, technical skill, and device profile; defects discovered late — mitigated by daily triage and parallel engineer availability during UAT rounds; sign-off friction — mitigated by publishing the exit criteria in advance and avoiding ambiguity at the close of the round.
