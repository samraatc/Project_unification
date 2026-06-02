# Security Audit Plan & Checklist

**Project:** Unified Marketing & E-Commerce Management Platform
**Cadence:** Continuous (CI) + Pre-launch (third-party) + Annual (third-party)
**Version:** 1.0

---

## 1. Audit Strategy

Security audit is a layered programme. The continuous layer runs in CI on every commit and PR — SAST, dependency scanning, container scanning, secrets scanning. The internal-review layer runs per sprint — code-review checklist for security-relevant changes, monthly access reviews, quarterly threat-model revisits. The third-party layer runs pre-launch (full penetration test) and annually (re-test plus a SOC 2 readiness review). The compliance layer is annual and covers PCI-SAQ-A self-assessment, GDPR controls review, and Nepal IRD compliance attestation for the Accounting module.

## 2. Continuous (CI) Audit

### 2.1 Static Analysis (SAST)

Semgrep runs on every PR with the OWASP ruleset plus a custom rule pack. Custom rules include: no `req.body` or `req.query` passed directly into a Mongoose query without schema validation; no `child_process.exec` with interpolated user input; no `eval`; no `dangerouslySetInnerHTML` outside the rich-text sanitiser; no `localStorage` for tokens or PII; no `console.log` of objects containing `password`, `token`, `email`, `phone`, or `card`. Findings of `error` severity block the merge; `warning` requires a documented justification.

### 2.2 Dependency Scanning

Snyk and `npm audit` run on every PR. New vulnerabilities of severity ≥ High block the merge until remediated or accepted with a documented expiry. Dependabot opens auto-PRs for security patches; the platform team's on-call merges within 48 hours for High/Critical, 5 business days for Medium.

### 2.3 Container Scanning

Trivy scans every container image post-build. Critical findings on the base layer trigger a base-image refresh; in the app layer, trigger an immediate patch. Images are signed with cosign and verified at K8s admission.

### 2.4 Secrets Scanning

Gitleaks runs as a pre-commit hook and in CI. Any committed secret triggers an immediate rotation of the leaked credential (procedure documented in the on-call runbook).

### 2.5 Dynamic Analysis (DAST)

OWASP ZAP runs nightly against staging with an authenticated session for each role (Super Admin, Admin, Editor, Accountant, Viewer, Customer). High-severity findings open a ticket; the security lead triages within one business day.

### 2.6 Infrastructure Scanning

Checkov and tfsec scan Terraform on every IaC PR for misconfiguration (open security groups, unencrypted storage, public S3, etc.).

## 3. Code-Review Checklist (per PR)

PRs touching authentication, RBAC, data access, payments, or accounting must answer the following before approval.

Does the change introduce a new route? If so, is it guarded by RBAC middleware with the correct permission code? If premium, is `requireEntitlement` applied? Is the entitlement code documented in the plan-entitlement matrix?

Does the change introduce a new Mongo query? Does it scope to the caller's tenant and the caller's resources (IDOR check)? Does it use a parameterised projection (no `$where`, no string-built selectors)? Is there an index that supports the query?

Does the change accept user input? Is it validated by a Zod schema at the route boundary? Is the schema exhaustive (no `passthrough` for sensitive endpoints)?

Does the change touch PII or accounting data? Is the audit log writing the before/after diff? Is the field encrypted if listed in the encrypted-fields registry?

Does the change introduce a new dependency? Is the dependency actively maintained (last release within 12 months) and free of known critical vulnerabilities? Is the licence acceptable?

Does the change interact with an external provider? Is the signature/auth verified? Is the operation idempotent? Is timeout and retry configured?

## 4. Access Review (Monthly)

A monthly access review is run by the security lead. The review enumerates every human user with production access (cloud console, VPN, DB proxy, Vault), confirms continued business need with the user's manager, and revokes orphaned access. The review is itself audited and the report stored alongside compliance artefacts. Service-account credentials are also reviewed and rotated as needed.

## 5. Threat-Model Revisit (Quarterly)

The threat model (`Threat-Model.md`) is reviewed quarterly and after every Sev-1 incident. Any new trust boundary, new external integration, or new data class triggers an update. The revisit includes a tabletop exercise of one randomly-chosen high-impact threat with the engineering, security, and operations teams.

## 6. Pre-Launch Penetration Test (Third-Party)

A reputable external firm conducts a 2-week penetration test of the platform 4 weeks before public launch. Scope: storefront, admin console, accounting portal, public API, webhook ingestion, infrastructure. The engagement includes a grey-box test (authenticated and unauthenticated) across all role classes plus a focused review of the payment and accounting flows. Findings are tracked in a dedicated remediation board with severity SLAs (Critical: 7 days, High: 14 days, Medium: 30 days, Low: 90 days). Launch is gated on zero open Critical and ≤ 2 open High findings.

## 7. Annual Penetration Test & Compliance

Annually post-launch, the same scope is re-tested by an external firm. PCI SAQ-A self-assessment is completed annually. GDPR controls review (consent flows, data export, deletion, breach notification readiness) is reviewed annually with legal counsel. SOC 2 Type II programme begins after the first annual pen test cycle.

## 8. Audit Logging Verification

The security team verifies audit-log integrity weekly. The verification runs a deterministic recomputation of the tamper-evident chain (each entry's hash equals SHA-256 of the previous entry's hash plus the entry's canonical JSON) and compares to the stored value. A mismatch triggers a Sev-1 investigation. Sampled spot checks compare audit entries to the actual `before/after` state in primary collections.

## 9. Vendor / Subprocessor Review

Every external subprocessor is listed in `08-legal/subprocessors.md`. Each subprocessor has a current DPA on file and a documented breach-notification SLA. Annually, the security team reviews each subprocessor's SOC 2 / ISO 27001 attestation and any incidents reported in the past year.

## 10. Audit Checklist — Pre-Launch Gate

The following must be green before public launch.

The third-party pen test report shows zero open Critical and ≤ 2 open High findings (each with documented mitigation). All Critical and High findings from CI tools are remediated or formally accepted with executive sign-off. The monthly access review for the launch month is complete. All subprocessors have a current DPA on file. The Privacy Policy and Terms are published and reviewed by legal counsel. The Incident Response runbook has been rehearsed (tabletop) within the previous 30 days. A DR drill has been executed successfully within the previous 60 days. The audit log is verified to be intact. The 2FA enrolment rate among Admin and Super Admin users is 100%.

## 11. Findings Register (template)

| ID | Source | Severity | Title | Status | Owner | Opened | SLA Due | Closed |
|---|---|---|---|---|---|---|---|---|
| SF-001 | Pen test | High | XSS in product description preview | Closed | FE Lead | 2026-04-12 | 2026-04-26 | 2026-04-20 |

Findings older than 30 days at any severity are escalated weekly to the security lead and monthly to the Project Sponsor.

## 12. Tooling Inventory

| Category | Tool |
|---|---|
| SAST | Semgrep, ESLint security plugin |
| Dependency scan | Snyk, Dependabot, `npm audit` |
| Container scan | Trivy, cosign |
| Secrets scan | Gitleaks |
| DAST | OWASP ZAP |
| IaC scan | Checkov, tfsec |
| Penetration test | Third-party firm (annual) |
| Error monitoring | Sentry (with PII scrubbing) |
| APM / detection | Datadog |
| WAF | Cloudflare WAF or AWS WAF |
| Secrets store | HashiCorp Vault / AWS Secrets Manager |
| Audit log | MongoDB + WORM S3 |

## 13. Reporting

A quarterly security report is delivered to the Project Sponsor summarising: CI scan trends, dependency aging, access-review outcomes, incidents and their post-incident actions, threat-model changes, and progress against the compliance roadmap.
