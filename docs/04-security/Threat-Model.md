# Threat Model

**Project:** Unified Marketing & E-Commerce Management Platform
**Method:** STRIDE per trust boundary
**Version:** 1.0

---

## 1. System Decomposition

The system is decomposed into the following components and trust boundaries, mirroring the architecture in `03-technical/Architecture.md`.

**Trust zones.** *Public Internet* (untrusted) — end customers, attackers. *Edge* (semi-trusted) — Cloudflare/CDN, WAF. *Public API* (semi-trusted) — Express API behind the gateway. *Internal services* (trusted) — workers, webhook service. *Data plane* (high-trust) — MongoDB, Redis, S3. *External providers* (semi-trusted) — payment gateways, social APIs, courier APIs, email/SMS/push.

**Trust boundaries.**

- TB1: Internet ↔ Edge/WAF.
- TB2: Edge ↔ Public API.
- TB3: Public API ↔ Internal services and data plane.
- TB4: System ↔ External payment, social, courier providers.
- TB5: Admin/Premium console ↔ Public API (elevated-privilege channel).

## 2. Data Flow Highlights

The customer purchase flow (storefront → API → Mongo → Payment Gateway → Webhook Service → Worker → Email/SMS/Push providers), the admin order-processing flow (admin UI → API → courier API), the social publishing flow (admin UI → API → social worker → Meta/TikTok APIs), and the premium accounting flow (admin/accountant UI → API with entitlement guard → Mongo accounting collections → S3 audit pack) are each traced and analysed below.

## 3. STRIDE — Trust Boundary by Trust Boundary

### 3.1 TB1: Internet ↔ Edge

**Spoofing.** Bots and credential-stuffing attempts. *Mitigation:* WAF bot-mitigation, Cloudflare Turnstile or hCaptcha on auth endpoints, breached-password screening on signup and password change.

**Tampering.** Injection (SQL/NoSQL/XSS) attempts at the edge. *Mitigation:* WAF managed rule sets, OWASP CRS, custom rules for known internal endpoints.

**Repudiation.** Anonymous abuse without traceability. *Mitigation:* request-ID header propagation, IP + UA logging at the edge, CAPTCHA on suspicious traffic.

**Information disclosure.** TLS downgrade, certificate-pinning bypass. *Mitigation:* TLS 1.3 only, HSTS preload, CAA DNS records, certificate transparency monitoring.

**Denial of service.** Volumetric and L7 floods. *Mitigation:* Cloudflare DDoS, WAF rate limiting, regional traffic blocks for verified attack origins, anycast DNS.

**Elevation of privilege.** Edge cache poisoning to escalate to authenticated cache hits. *Mitigation:* never cache authenticated responses; Vary on Authorization; cache key includes path + query only.

### 3.2 TB2: Edge ↔ Public API

**Spoofing.** JWT forgery, token theft from XSS. *Mitigation:* RS256 signing with key rotation, short TTL, refresh rotation; CSP and HttpOnly cookies; sensitive operations require re-auth or 2FA challenge.

**Tampering.** Parameter pollution, body manipulation. *Mitigation:* Zod schema validation at every route boundary; reject `$`-prefixed keys; reject prototype-pollution attempts (`__proto__`, `constructor`).

**Repudiation.** User denies an action they performed. *Mitigation:* immutable audit log with actor, IP, UA, request ID; every mutation logged.

**Information disclosure.** Over-fetching from list endpoints; verbose error responses. *Mitigation:* scope.applyForUser on every list query; uniform error envelope; no stack traces in production responses.

**Denial of service.** Slow-loris, expensive query (Mongo aggregation on huge datasets). *Mitigation:* request timeout, body-size limit, slow-query monitor with auto-kill; aggregation pipelines gated by Atlas projections and limits.

**Elevation of privilege.** RBAC bypass via direct ID guessing (IDOR), missing entitlement check on premium routes. *Mitigation:* IDOR-resistant query patterns (always include `userId` or tenant scoping); contract tests assert RBAC and entitlement on every premium route in CI.

### 3.3 TB3: API ↔ Data Plane / Internal Services

**Spoofing.** Internal-service impersonation. *Mitigation:* Kubernetes service-account JWT auth between services; mTLS optional (planned post-launch).

**Tampering.** Direct DB manipulation bypassing application logic. *Mitigation:* DB credentials available only to API/worker pods via Vault; no direct human DB access in production — read-only proxy via a "DB proxy" pod with audited queries.

**Repudiation.** Worker actions without attribution. *Mitigation:* workers include the originating user/event in their audit-log writes; system actions tagged `actor='system:worker:<name>'`.

**Information disclosure.** Backup leak, log leak. *Mitigation:* backups encrypted with KMS; log redaction at the SDK layer for known PII fields; log-shipper config audited.

**Denial of service.** Queue saturation, hot-partition. *Mitigation:* BullMQ rate-limiting per queue; queue depth alerts; sharding strategy on Mongo for hot collections (e.g. `orders` by tenant + month).

**Elevation of privilege.** A misconfigured worker with broader DB access than intended. *Mitigation:* per-worker DB user with least-privilege roles (e.g., the `social-publish` worker can read posts and write status updates but cannot read users).

### 3.4 TB4: External Providers

**Spoofing.** Forged webhook callbacks. *Mitigation:* signature verification on every inbound webhook (Stripe, eSewa, Khalti, PayPal, Pathao, Aramex, Meta, TikTok); reject unsigned or invalid-signature payloads immediately.

**Tampering.** Replayed webhook events. *Mitigation:* idempotency on `paymentEvents.externalEventId` (and equivalent for other providers); duplicate delivery is a no-op.

**Repudiation.** Provider claims an event was not sent. *Mitigation:* store full raw payload alongside verified signature for the retention window.

**Information disclosure.** Leaking secrets to providers. *Mitigation:* providers receive only the minimum necessary fields; no PII in logs sent to third-party error trackers (Sentry configured with PII scrubbing).

**Denial of service.** Provider outage breaks our checkout. *Mitigation:* multi-gateway design; UI suggests alternative method; orders held Pending for 24h.

**Elevation of privilege.** OAuth token theft from a tenant's social account leading to platform escalation. *Mitigation:* tokens encrypted with KMS data keys; access tokens stored only as needed; refresh tokens used to mint short-lived access tokens per publish; revocation pipeline if a tenant reports compromise.

### 3.5 TB5: Admin & Premium Console

**Spoofing.** Insider on a shared device. *Mitigation:* 2FA TOTP required for Super Admin and Admin; session re-auth required for sensitive operations.

**Tampering.** Admin user modifies a sensitive record. *Mitigation:* every mutation audited with before/after JSON; period close prevents retroactive edits in accounting; reversal entries are explicit, not silent edits.

**Repudiation.** Admin denies making a change. *Mitigation:* same audit log + tamper-evident chain in the accounting domain.

**Information disclosure.** Admin exfiltrates PII or financial data. *Mitigation:* exports are audited and rate-limited; the "Export all customers" action requires a 2FA challenge and is escalated to security review for unusually large exports; DLP scanning planned for v1.3.

**Denial of service.** Admin accidentally cancels an entire batch of orders. *Mitigation:* bulk actions show a typed-confirmation prompt; bulk cancel/refund requires a second approver above N=50 orders.

**Elevation of privilege.** Admin grants self Super Admin. *Mitigation:* only existing Super Admin can grant Super Admin; the action requires a second Super Admin's approval if more than one exists (configurable, default on).

## 4. Top-10 Threats — Ranked

1. **Credential stuffing on customer accounts.** *Likelihood: high. Impact: medium-high (account takeover, fraudulent orders).* Mitigations: bot detection, password breach screening, MFA encouragement, anomaly detection.

2. **Payment webhook spoofing / replay.** *Likelihood: medium. Impact: high (fraudulent order confirmation, financial loss).* Mitigations: signature verification + idempotency on every webhook.

3. **IDOR on order detail endpoints.** *Likelihood: medium. Impact: high (PII + financial leak).* Mitigations: scope.applyForUser on every read; contract tests assert.

4. **JWT theft via XSS in user-generated content.** *Likelihood: medium. Impact: high.* Mitigations: React escaping, CSP, DOMPurify, HttpOnly refresh, sensitive-action re-auth.

5. **OAuth token leak from social account compromise.** *Likelihood: low. Impact: high.* Mitigations: KMS envelope encryption, token rotation, revocation playbook.

6. **Bulk admin export of PII.** *Likelihood: low. Impact: high.* Mitigations: exports audited, throttled, sensitive-action re-auth, DLP on the roadmap.

7. **Accounting period tampering.** *Likelihood: low. Impact: very high (compliance).* Mitigations: period-close locking, append-only journals, reversal-only edits, tamper-evident chain, audit-pack signing.

8. **Inventory race condition on flash-sale.** *Likelihood: medium. Impact: medium (oversell + customer churn).* Mitigations: atomic Mongo `findOneAndUpdate` with `$inc` guard; load test before flash sales.

9. **Subprocessor breach (Stripe / SendGrid / Atlas).** *Likelihood: low. Impact: high.* Mitigations: DPA + breach-notification SLAs, customer notification plan, post-breach key rotation.

10. **Insider abuse by an engineer with prod access.** *Likelihood: low. Impact: high.* Mitigations: no human DB access in prod; audited proxy queries; quarterly access review; just-in-time elevated access via PAM.

## 5. Threat-Model Maintenance

This document is reviewed quarterly and after every Sev-1/Sev-2 incident. Any new external integration, new role, or new collection requires an entry in the relevant TB section before merge. The threat model is part of the security-review checklist for major releases.
