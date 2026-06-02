# Quality Assurance (QA)

**Project:** Unified Marketing & E-Commerce Management Platform
**Version:** 1.0

---

## 1. QA Approach

QA is shift-left: defects caught at the design and code-review stages are cheaper than defects caught in QA, and defects caught in QA are cheaper than defects caught in production. The QA Engineer partners with engineers from sprint planning onward — reviewing acceptance criteria, helping decompose stories into testable slices, and writing acceptance tests in parallel with implementation.

The QA function in v1 is owned by one QA Engineer with support from every team member writing their own unit and integration tests. The QA Engineer specialises in: exploratory testing, e2e automation maintenance, performance scenario design, UAT facilitation, regression strategy.

## 2. QA Process per Sprint

Sprint planning: QA reviews each story's acceptance criteria, calls out missing edge cases, sizes the test work alongside the development work.

Sprint execution: QA pairs with the engineer on the story's first end-to-end pass — running the story on a preview environment, writing the e2e test, capturing demo notes. QA also runs exploratory testing across the broader area touched by the change.

Sprint review: QA presents the sprint's test results — new tests added, regressions caught, defects open and closed, coverage delta.

Sprint retrospective: QA contributes observations on test pain-points and proposes process tweaks.

## 3. Defect Lifecycle

A defect moves through `New` → `Triaged` → `In Progress` → `In Review` → `Verified` → `Closed`. Triage runs daily; the Tech Lead, QA, and on-call review the inbox of new defects and assign severity, priority, and owner.

Severity scale (impact):

- **S1 Critical.** Service down, data loss, security breach, payment broken, accounting integrity at risk.
- **S2 Major.** Significant feature broken with no workaround; affects many users.
- **S3 Moderate.** Feature broken with a workaround, or affects a minority.
- **S4 Minor.** Cosmetic, edge-case, low impact.

Priority scale (urgency to fix):

- **P0** — fix immediately, drop other work.
- **P1** — fix this sprint.
- **P2** — fix in the next sprint or two.
- **P3** — backlog; revisit at the next planning.

The mapping is loose: a S2/P0 (broken feature, urgent due to launch window) is normal; an S4/P0 (cosmetic but on the launch screenshot) also happens.

SLA: S1 fixed within 24 hours of triage. S2 fixed within 5 business days. S3 fixed within the sprint. S4 lives in the backlog until prioritised.

## 4. Acceptance Criteria Standard

Every story includes acceptance criteria in Given-When-Then format. The criteria are testable, single-purpose, and cover happy path plus the obvious negative paths. Example:

```
Given a logged-in customer with an active cart containing one item
When the customer applies a valid percentage-discount coupon for that product
Then the cart total reflects the discount applied to that line item
And the discount line appears in the cart totals breakdown
And applying a second coupon replaces the first (only one coupon allowed)
```

A story without testable acceptance criteria is not ready for development.

## 5. Test Areas — Coverage Matrix

| Area | Unit | Integ | E2E | Perf | Security | A11y | Visual |
|---|---|---|---|---|---|---|---|
| Auth & RBAC | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Catalogue | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Search | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Cart & Checkout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payment | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Orders & Inventory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Social Hub | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Premium Accounting | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Subscription | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |

## 6. Exploratory Testing

Exploratory sessions are time-boxed (45–90 minutes) and follow a charter — "explore the checkout flow on iOS Safari, focused on coupon edge cases, testing for input validation failures." Session notes capture: what was tested, what was learned, what was found. Notable findings open defects; the session log itself is filed in the QA wiki.

Charters are scheduled in advance for each sprint, prioritising areas with recent changes, high customer impact, or known weak coverage.

## 7. Regression Strategy

Three regression layers run continuously.

The **automation layer** is the e2e suite — nightly against staging, on every PR for the smoke subset, on the release candidate for the full suite.

The **smoke layer** is a hand-curated set of 30-minute tests executed manually before any production deploy, covering payment, login, checkout, social publish, accounting export. The smoke checklist lives in the on-call runbook and is shared in the release Slack channel.

The **scripted regression layer** runs once per sprint and covers areas that resist automation — visual fidelity, motion correctness, multi-device feel — and produces a report scored against a rubric.

## 8. Mobile & Cross-Browser

Browsers in scope: Chrome, Edge, Firefox, Safari — current and current-minus-one. Mobile: iOS Safari and Android Chrome — current and current-minus-one. Automated coverage runs on Chromium and WebKit in Playwright; the QA Engineer hand-tests Safari (desktop and iOS), Firefox, and Edge once per sprint and pre-release.

PWA installation flow is hand-tested on Chrome desktop, Edge, iOS Safari (Add to Home Screen), and Android Chrome (install prompt).

## 9. Performance QA

Performance budgets are set in `06-testing/Test-Plan.md` Section 2.5. The QA Engineer runs the weekly k6 baseline and reports deltas; a 10% regression on any p95 metric is investigated and gates the release. Synthetic monitors (Datadog) run every 5 minutes from three regions against production after launch.

## 10. Accessibility QA

Beyond the automated axe checks, the QA Engineer performs manual a11y testing once per sprint on the changed pages: keyboard-only navigation, screen reader (NVDA on Windows, VoiceOver on macOS and iOS), zoom to 200%, high-contrast mode, reduced-motion preference. Findings open defects with the WCAG criterion cited.

## 11. Premium Module QA

The Accounting module is held to a higher bar because financial accuracy is non-negotiable. The QA programme adds: a **double-entry property test** that asserts every auto-posted journal entry balances (debits = credits) and matches the source event; an **audit-chain integrity test** that recomputes the SHA-256 chain on the last 10,000 entries; a **regulator-format test** that validates VAT 200, GSTR-1, GSTR-3B, and Nepal IRD e-invoice JSON outputs against published schemas; a **bank-reconciliation test** that runs a curated CSV through the matcher and asserts the expected matches and confidence scores.

A Chartered Accountant reviews the accounting outputs at the end of Phase 6 and signs off before the Premium tier is offered for sale.

## 12. UAT

User Acceptance Testing is covered in `06-testing/UAT.md`. The QA Engineer coordinates the UAT participants, prepares the test data, schedules the sessions, captures findings, and drives them to closure.

## 13. Tooling

Test management: a lightweight Linear or Notion board for tracking defects, test plans, and exploratory session charters. The full test suite results are pulled into the same board nightly for visibility.

Automation: Vitest, Playwright, k6, axe-core, Percy/Chromatic, OWASP ZAP, Lighthouse, Storybook.

## 14. Metrics

The QA function tracks: defect counts by severity and module, escape rate (defects found in production divided by total defects), mean time to verify, automated test coverage and trend, e2e flake rate, performance budget adherence, accessibility audit score per sprint, customer-reported defects per week post-launch.

The metrics dashboard is shared at every sprint review and reported monthly to the Project Sponsor.
