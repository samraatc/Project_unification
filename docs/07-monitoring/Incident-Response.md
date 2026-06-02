# Incident Response

**Project:** Unified Marketing & E-Commerce Management Platform
**Version:** 1.0

---

## 1. Purpose

This document is the operational runbook for incident response. It defines severity, roles, escalation paths, communication, and per-scenario playbooks. It is owned by the on-call lead and reviewed quarterly and after every Sev-1.

## 2. Severity Scale

**Sev-1 — Critical.** Service-wide outage; data loss; security breach; payment broken end-to-end; accounting integrity compromised. Page primary on-call 24×7. Customer-impact externally visible. Incident commander declared within 5 minutes.

**Sev-2 — Major.** Significant feature broken with no workaround; affects many users; performance budget exceeded for sustained period; partial outage in a key subsystem (e.g., one payment gateway down). Page primary on-call 24×7 with a 1-hour acknowledgement window. Customer-impact visible to a subset.

**Sev-3 — Moderate.** Degraded performance with workarounds available; affects a minority of users; non-critical subsystem degraded (e.g., social publish failing for one platform). Business-hours page; channel notification 24×7.

**Sev-4 — Minor.** Cosmetic, edge-case, or low-impact. Channel notification only; addressed in the next sprint.

## 3. Roles

**Incident Commander (IC).** Owns the response. Makes the call on declarations, communications, escalations. Not a debugger — the IC's job is to coordinate. On-call primary is IC by default; can hand off if a deeper engineer is needed to debug.

**Communications Lead.** Updates the status page, sends customer email, posts to the relevant Slack channel, briefs the Project Sponsor. Defaults to the Product Owner during business hours; the on-call IC handles communications outside business hours.

**Subject-Matter Experts (SMEs).** Domain engineers pulled in by the IC for debugging. The IC delegates investigation but retains the response.

**Scribe.** Captures the timeline. For Sev-1 and Sev-2 the IC typically scribes themselves into a shared incident document; for prolonged incidents the IC nominates another team member.

## 4. Declaration

Any engineer can declare an incident. The declaration is made in the `#incidents` Slack channel with a one-line summary, suspected severity, and the page that triggered it (Datadog monitor link, Sentry issue link). PagerDuty fires the corresponding rotation. The IC is announced within 5 minutes.

## 5. Communication

**Internal.** The `#incident-<id>` Slack channel is created automatically by the bot. All discussion happens there for traceability. The channel becomes the single source of truth during the incident.

**External (customer).** For Sev-1 and Sev-2, the status page is updated within 30 minutes of declaration with a brief, no-jargon description. Updates every 30 minutes until resolution. Enterprise tenants on the affected scope receive a direct email from the Communications Lead. Sev-3 may post a status-page note depending on customer impact; Sev-4 typically does not.

**External (regulator).** Personal-data breach notifications are made within 72 hours per GDPR Article 33 when the breach affects PII. Legal counsel is engaged immediately on suspicion of a breach.

## 6. Resolution & Postmortem

An incident is resolved when the user-facing symptom is no longer observable and a monitoring window has passed without recurrence. The IC declares resolution and the channel is closed (but archived).

A post-incident review is held within 5 business days. The output is a written blameless review covering: incident timeline, root cause, contributing factors, customer impact, what went well, what didn't, action items with owners and due dates. The review is shared with the engineering team and the Project Sponsor. Action items are tracked in the next sprint planning and not allowed to age beyond two sprints without escalation.

## 7. Per-Scenario Playbooks

### 7.1 API Down / 5xx Spike

1. Confirm the symptom on the Datadog API dashboard (error rate, p95 latency, request rate).
2. Check the deploy timeline for a recent release — if a release is in flight, consider rollback first.
3. Check Atlas Activity Feed for primary failover or alerts.
4. Check Redis status for eviction or saturation.
5. Check Sentry for a new error signature; pull the stack and trace.
6. If a release is implicated: `argocd app rollback platform-api <prev>`. If Atlas: wait for failover and confirm. If Redis: scale or restart.
7. Communicate progress every 30 minutes.

### 7.2 Payment Gateway Failure

1. Identify which gateway (eSewa, Khalti, Stripe, PayPal). Check the gateway's status page.
2. If a single gateway is down, route storefront UI to suggest alternative methods (feature flag).
3. Confirm orders are held Pending (not lost). Confirm the abandoned-checkout email job is running.
4. If a webhook backlog is suspected: replay from the provider's dashboard (Stripe replay, eSewa support, etc.).
5. Post status-page incident scoped to the affected payment method.

### 7.3 Payment Webhook Signature Failures Spiking

This is a potential attack or a config drift after a key rotation.

1. Check the failing-webhook logs: which provider, which signature, what payload structure?
2. Confirm the webhook signing secret in Vault matches the provider's current secret.
3. If a recent rotation: verify the old + new secret are both accepted during the rotation window.
4. If the spike is from a single IP or a small range: block at WAF and continue investigation.
5. If genuinely under attack: alert the security lead, raise to Sev-1 if customer impact, engage Cloudflare support.

### 7.4 Mongo Atlas Primary Failover

1. Confirm on the Atlas Activity Feed.
2. Confirm the application reconnected (Datadog driver metric).
3. Review the dead-letter queue for transactions that failed mid-election; replay where safe.
4. If failover repeats: contact Atlas support; consider a maintenance window for a controlled failover and root-cause.

### 7.5 Data Corruption / Bad Migration

1. Stop the migration immediately if still running.
2. Identify the scope: which documents, which fields.
3. Determine the last known-good PIT timestamp.
4. Restore from Atlas PIT into a parallel cluster (see `05-devops/Backup-Recovery.md` §5.1).
5. Validate via audit-log chain integrity check.
6. Cut over to the restored cluster via DNS or connection-string update.
7. Forensic write-up captures: how the bad migration was authored, how it bypassed review, how the test suite missed it.

### 7.6 Region Outage

Follow the DR procedure in `Backup-Recovery.md` §4.4. The IC owns the cut-over decision after consulting the DevOps Lead and Project Sponsor.

### 7.7 Suspected Account Compromise (Tenant or Internal)

1. Lock the affected account(s) immediately.
2. Revoke all active sessions and refresh tokens for the affected accounts.
3. Audit the recent activity from the affected account; flag any unusual data export, role grant, or financial operation.
4. Reverse any unauthorised actions where possible (refund reversal, role revoke, journal reversal).
5. Notify the affected tenant; if breach criteria met, notify regulator within 72 hours.
6. Forensic write-up captures: vector, blast radius, mitigation.

### 7.8 Audit Chain Integrity Failure

This is the highest-severity scenario for the Accounting module — the immutability guarantee is broken.

1. Declare Sev-1 immediately. Engage the security lead and Project Sponsor.
2. Freeze writes to the affected accounting collections (set the worker pool's concurrency to zero).
3. Identify the divergence point — which entry first breaks the chain?
4. Determine whether the divergence is a true tampering or an operational anomaly (e.g., a clock skew or a buggy migration).
5. If tampering: forensic investigation with an external firm; regulator notification; customer notification.
6. If operational: restore the affected entries from PIT backup; rebuild the chain; resume writes; document the operational gap in the post-incident review.

### 7.9 Subscription / Billing Issue

1. Identify the affected tenants. Are they being incorrectly charged, incorrectly downgraded, or incorrectly entitled?
2. If incorrect entitlement (premium feature locked for a paid tenant): hotfix the entitlement cache invalidation; verify via a contract test.
3. If incorrect charge: refund through the gateway; communicate with the tenant.
4. If dunning misfires: pause the dunning worker; review the rules; resume.

### 7.10 Social Publish Failures

1. Identify the platform (Facebook, Instagram, TikTok). Check the platform's status.
2. Check if the OAuth token has expired — refresh-token rotation may have failed; re-auth the tenant's social account.
3. Check rate-limit response from the provider; if rate-limited, back off and surface in the admin UI.
4. If sustained, post a status-page note scoped to the affected platform.

## 8. Escalation

If the IC determines the incident is beyond the on-call team's capacity, escalation paths are:

- **Engineering Director.** Reachable within 15 minutes.
- **Project Sponsor / Executive.** Reachable within 30 minutes for Sev-1.
- **Vendor support.** Atlas, Cloudflare, Datadog, Stripe — contact details and account numbers in the on-call runbook.
- **External security firm.** On retainer for forensic incident support.

## 9. Drills

Tabletop drills are run quarterly. Each drill picks a scenario from §7 and walks the team through the response without touching production. The IC for the drill is a randomly-selected on-call engineer. The output is a list of gaps in the runbook, addressed before the next drill.

A live DR drill is run quarterly per `Backup-Recovery.md`; a Sev-1-equivalent live drill against a synthetic outage is run annually.

## 10. Tooling Quick Reference

- PagerDuty — paging and rotation.
- Datadog — dashboards, monitors, logs, RUM, synthetics, APM.
- Sentry — error tracking with source maps.
- Atlas Console — cluster ops, PIT restore.
- AWS Console — break-glass via PAM JIT.
- Cloudflare — WAF, DDoS, DNS.
- ArgoCD — deploy state, rollback.
- GitHub — release notes, code archaeology.
- Statuspage — customer comms.
- Slack `#incidents`, `#incident-<id>` — coordination.

## 11. On-Call Schedule

Two-engineer rotation, weekly handover Monday 09:00 local. Schedule maintained in PagerDuty. Engineers can swap shifts within the team without manager approval; cross-team swaps require lead approval.

## 12. Compensation & Wellbeing

On-call shifts carry a stipend per the company's compensation policy. Engineers who handled a Sev-1 outside business hours receive comp time the following business day. The on-call lead monitors burnout signals and rebalances the rotation as needed.
