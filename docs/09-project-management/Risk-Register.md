# Risk Register

**Project:** Unified Marketing & E-Commerce Management Platform
**Owner:** Project Manager
**Cadence:** Reviewed every sprint; updated on any material change
**Version:** 1.0

---

## 1. Scoring Scale

| Likelihood | Definition |
|---|---|
| Low | < 10% chance over the project window |
| Medium | 10–40% |
| High | > 40% |

| Impact | Definition |
|---|---|
| Low | < 1 week schedule, < 2% budget, no user-visible degradation |
| Medium | 1–4 weeks, 2–5% budget, contained user-visible degradation |
| High | > 4 weeks, > 5% budget, major user-visible degradation or compliance risk |

## 2. Register

| # | Risk | Likelihood | Impact | Owner | Mitigation |
|---|---|---|---|---|---|
| R1 | Social API policy / pricing changes (Meta, TikTok) | Medium | High | Social API Specialist | Abstraction layer in code so adapters swap behind a stable interface; documented swap-out path; subscribe to changelogs; quarterly review of provider terms. |
| R2 | Payment gateway downtime (eSewa, Khalti, Stripe) | Low | High | Backend Lead | Multi-gateway architecture with UI-suggested failover; clear retry UI; orders held Pending 24h with retry link; abandoned-checkout email. |
| R3 | Scope creep delaying launch | High | Medium | PM | Strict change-control; new requests routed to post-launch backlog; signed-off scope per phase; PM authority to defer; Sponsor escalation only above 1-sprint-of-effort threshold. |
| R4 | Data privacy / GDPR / local regulator gaps | Medium | High | Tech Lead + Legal | Privacy-by-design in Phase 1 (consent, export, deletion flows); annual legal review; DPAs with all subprocessors; data-residency option for Enterprise. |
| R5 | Performance under flash-sale load | Medium | Medium | DevOps Lead | Load test before launch and before any campaign; CDN + Redis caching; queue-based order intake; autoscaling pre-warmed; flash-sale playbook documented. |
| R6 | Key engineer departure mid-build | Low | Medium | PM | Documentation standards from day 1; pair programming; knowledge-sharing each sprint; PRs require two reviewers in security-sensitive areas; "no single point of knowledge" rule. |
| R7 | Accounting module accuracy issues | Medium | High | Accounting Specialist + Backend Lead | Hire domain specialist for full Phase 6; double-entry property tests on every event; reconciliation tooling; independent CA review before pricing as a paid product; pilot with friendly customer before public sale. |
| R8 | Premium subscription churn | Medium | Medium | Product Owner | Strong onboarding; in-app NPS; scheduled health-check emails; export-on-cancel reduces lock-in fear; quarterly churn root-cause review. |
| R9 | Courier integration unreliability | Medium | Medium | Backend Lead | Manual override path; tracking via courier-pulled status if webhook is silent for > 2 hours; per-courier circuit breaker. |
| R10 | Currency / FX fluctuation in pricing | Low | Low | Finance + Backend | Daily FX feed; tenant chooses settlement currency; quote-in-NPR option for local pricing. |
| R11 | Atlas / Cloud outage (region-wide) | Low | High | DevOps Lead | Multi-AZ deployment in primary region; cross-region snapshot; DR procedure rehearsed quarterly; documented RTO/RPO. |
| R12 | Webhook spoofing / replay attack | Medium | High | Security Lead | Signature verification on every inbound webhook; idempotency on provider event ID; rate limit + WAF; replay protection via stored event ID. |
| R13 | Bulk admin data export by insider | Low | High | Security Lead | Audit log of all exports; rate-limit; sensitive-action re-auth; DLP on accountant exports planned for v1.3; quarterly access review. |
| R14 | Premium gating bypass (entitlement bug) | Low | High | Backend Lead + QA | Contract tests assert entitlement on every premium route in CI; entitlement cache invalidation tested; manual QA pass before any release touching billing. |
| R15 | Phase 6 dependency on CA discovery delays start | Medium | Medium | PM + Sponsor | CA engaged in Phase 4; 4-week discovery completes before Phase 6 build; contingency plan to start with sample CoA if CA slips. |
| R16 | Spline / heavy 3D hero hurts performance | Medium | Low | Frontend Lead + Designer | Lazy-load with Intersection Observer; fall back to static image on low memory or `prefers-reduced-motion`; performance budget enforced via Lighthouse CI. |
| R17 | Insufficient designer bandwidth for full Neumorphic system | Medium | Medium | Designer + PM | Component-first design: ship the system primitives in Phase 0 + 1; reuse across surfaces; supplement with senior contractor if scope expands. |
| R18 | OAuth token theft from a tenant's social account | Low | High | Security Lead | KMS envelope encryption; tokens never exposed to the browser; revocation playbook; per-tenant scope. |
| R19 | Test-coverage gate slowing delivery | Medium | Low | Tech Lead | Coverage as floor not target; reviewers reject low-quality tests; QA pairs with engineers on test design; coverage waivers permitted with documented justification. |
| R20 | UAT slips due to participant availability | Medium | Medium | QA + PM | Recruit participants 2 sprints before; over-recruit by 20%; backup slots scheduled; remote-friendly format. |
| R21 | Pen test surfaces blocking findings late | Medium | High | Security Lead + Backend Lead | Internal security review through every sprint; SAST + DAST + dependency scans in CI; pen test scoped 4 weeks before launch to leave remediation room. |
| R22 | Vendor pricing changes (Atlas, Datadog, SendGrid) | Medium | Low | DevOps Lead + Finance | Annual contract negotiation; tracking of usage; alternative providers documented; multi-cloud-portable design. |
| R23 | Email deliverability degrades | Medium | Medium | Backend Lead | Warm-up new sending domains; SPF + DKIM + DMARC configured; monitor bounce + complaint rates; fallback provider on standby. |
| R24 | Audit log chain integrity break (true tampering or operational bug) | Low | Very High | Security Lead | Continuous chain-recompute check; Sev-1 alert; freeze writes on detection; documented investigation playbook; backup-restore path. |
| R25 | Underestimated Phase 6 complexity | Medium | High | Accounting Specialist + PM | Two-week buffer reserved in Phase 6; CA on call during build; explicit "review-only" sprints before sign-off; phased internal pilot before paid release. |

## 3. Risk Lifecycle

Risks move through `Open` → `Monitoring` → `Realised` → `Closed`. A realised risk becomes an incident and follows `07-monitoring/Incident-Response.md`. A closed risk remains in the register with the date and a one-line note on why it is closed.

New risks are added at sprint review or any time during the sprint by any team member. The PM owns the register; risk owners drive their mitigations.

## 4. Sponsor Escalation

A risk is escalated to the Project Sponsor within 24 hours when: likelihood transitions to High and impact is at least Medium; the risk materialises as a blocker; mitigation requires budget or scope change. The Sponsor receives a one-page summary covering: what happened, what we are doing, what we need, by when.

## 5. Risk-Adjusted Budget

The Master Plan §11 reserves 15% contingency on the year-1 budget for risk realisation. The PM and Sponsor review contingency consumption monthly. Material consumption (e.g., > 25% of contingency drawn) triggers a budget conversation with the Sponsor.

## 6. Reviewed-Closed Risks (Examples — Empty at Project Start)

(This section will populate as risks are closed during the project. Each entry includes: risk number, title, date closed, reason.)

## 7. Notes on Risk Style

Risks here are written as the thing we are worried about, not as the mitigation. A good risk is specific enough to assign an owner and measure mitigation against. A risk that says "things might go wrong" is rewritten before being accepted. The register favours a small number of well-described risks over a long list of vague ones.
