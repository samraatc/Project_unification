# Security Requirements

**Project:** Unified Marketing & E-Commerce Management Platform
**Standard:** OWASP ASVS Level 2 (target), PCI-SAQ-A (Stripe-Elements scope)
**Version:** 1.0

---

## 1. Scope & Standards

The platform targets OWASP ASVS Level 2 across all surfaces, PCI-DSS SAQ-A by virtue of Stripe Elements (no card data ever touches our servers), and GDPR-aligned data handling. Nepal IRD requirements drive the audit trail and e-invoice controls. The premium Accounting module additionally targets ISAE 3402 / SOC 2 Type I within 12 months of launch and Type II within 24 months.

## 2. Authentication

Passwords are stored with bcrypt cost 12, with a documented cost-rotation procedure as hardware capability grows. Password policy: minimum 12 characters, no maximum below 128, no composition rules beyond NIST 800-63B guidance, screened against a breached-password list (HaveIBeenPwned API or local Bloom filter). Account lockout uses a sliding-window strategy: 5 failed attempts triggers a 1-minute cool-down, escalating to 15 minutes after 10 failures, with an email alert to the user.

JWT access tokens have a 15-minute TTL; refresh tokens have a 7-day TTL with rotation on every use and family-revocation on suspected theft (reuse of a previously rotated token revokes the whole family). Access tokens are signed with RS256 keys rotated every 90 days; the public JWK set is served at `/.well-known/jwks.json`. Refresh tokens are HttpOnly, Secure, SameSite=Strict cookies.

2FA via TOTP (RFC 6238) is required for Super Admin and Admin and is offered to all users. Backup codes are one-time-use, hashed at rest, and limited to 10 per generation. WebAuthn / passkey support is on the post-launch roadmap.

OAuth 2.0 social login uses PKCE; `state` and `nonce` parameters are validated server-side; tokens received from Google/Facebook are exchanged server-side only and never exposed to the browser.

## 3. Authorisation

The RBAC engine is the single source of truth for permission decisions. Every API route is decorated with `require('domain.action')` middleware that runs before the handler. Decisions are deny-by-default; the absence of a permission means denial. The user's permission set is computed by union of all their role permissions, cached in Redis with a TTL of 5 minutes, and invalidated on any role assignment change.

Premium routes additionally call `requireEntitlement('feature_code')` which checks the tenant's active subscription against the feature gate. Entitlements are recomputed and cached on every subscription state change.

Row-level access (a customer can only see their own orders, an admin scoped to a region can only see orders in that region) is enforced in service-layer query builders, never left to the controller. Every list endpoint funnels through a `scope.applyForUser(query, user)` helper.

## 4. Encryption

### 4.1 In Transit

TLS 1.3 only, with TLS 1.2 fallback disabled. HSTS preload (`max-age=63072000; includeSubDomains; preload`). Modern cipher suites only (AES-GCM, ChaCha20-Poly1305). HTTP/2 and HTTP/3 enabled. Certificate management via Cloudflare and ACME (Let's Encrypt) with auto-renewal.

### 4.2 At Rest

MongoDB Atlas storage encryption with AES-256. Object storage (S3) with SSE-S3 default and SSE-KMS for accounting artefacts. Backups encrypted with separate KMS keys. Disk encryption (LUKS / GCE) on any underlying VM volumes.

### 4.3 Application-Level

Sensitive fields (`oauth.accessToken`, `oauth.refreshToken`, `socialAccounts.oauth.*`, `twoFA.secret`) are encrypted with envelope encryption: a per-tenant data key managed by KMS encrypts field values; the data key itself is encrypted by a customer master key. Decryption requires both the KMS key and the database read. Mongo CSFLE (Client-Side Field-Level Encryption) is used for the most sensitive PII fields where zero-knowledge guarantees are required (planned for Phase 1.5).

### 4.4 Secrets

Application secrets live in HashiCorp Vault (or AWS Secrets Manager / GCP Secret Manager). No secrets in code, environment files committed to git, or container images. Workloads authenticate to Vault using short-lived workload identity tokens (Kubernetes Service Account → JWT → Vault role). Secret rotation cadence: API keys rotated quarterly, JWT signing keys every 90 days, database credentials every 60 days.

## 5. Input Handling

All request bodies, query parameters, and headers pass through a Zod schema validator at the route boundary. Outputs are likewise schema-typed. SQL injection is not applicable (Mongo) but NoSQL injection is mitigated by parameterised queries via Mongoose, rejection of `$`-prefixed keys in user input, and forbidden-operator middleware. XSS is mitigated by React's default escaping plus a strict Content-Security-Policy and an HTML sanitiser (DOMPurify) on user-generated rich content (reviews, product descriptions). SSRF is mitigated by an allow-listed HTTP client wrapper used for all outbound calls from user-supplied URLs (e.g., webhook callbacks); raw `fetch` is forbidden in user-input paths. File uploads validate MIME type by header inspection, scan with ClamAV before public availability, and store in a separate bucket with no execution policy.

## 6. Rate Limiting & Abuse

Authenticated endpoints: 600 req/min/token. Auth endpoints: 60 req/min/IP, 10 req/min/identifier (email/phone). Payment endpoints: 5 req/sec/token, with a per-tenant daily ceiling. Search auto-suggest: 60 req/min/IP. Limits use Redis token-bucket; `RateLimit-*` headers communicate state. WAF (Cloudflare or AWS) sits in front with bot mitigation and DDoS protection.

## 7. Session Management

Refresh tokens are HttpOnly, Secure, SameSite=Strict. Logout revokes the refresh-token family; concurrent sessions are tracked and listable in the user's "Active sessions" UI with per-session revoke. Session fixation is prevented by always issuing a new refresh token on login. CSRF is mitigated by SameSite cookies and an additional double-submit token for state-changing endpoints used by browser apps.

## 8. Audit Logging

Every mutation captures `{ actor, action, entity, entityId, beforeJson, afterJson, ip, ua, ts, requestId }`. Audit entries are append-only and stored in a separate Mongo collection with backup to WORM-style object storage. Premium accounting events additionally write to a tamper-evident chain (each entry includes a SHA-256 of the previous entry's hash). Audit log access is itself logged. Purge of audit logs is permitted only for Super Admin and only via a multi-party authorisation workflow that is itself audited.

## 9. Premium / Accounting Controls

Premium accounting requires a separate stronger-auth ceremony when accessing or exporting audit-sensitive data: a fresh password challenge within the last 15 minutes or a fresh 2FA challenge. Period close, journal reversal, and audit-pack export are restricted to Super Admin or an entitled Accountant. Exported audit packs are signed with SHA-256 over the manifest and stamped with the actor and timestamp.

## 10. Payment Security

Card data never touches our servers. Stripe Elements (and PayPal Hosted) tokenise card data client-side; our servers handle only the token. eSewa and Khalti use signed redirect flows and verification API calls; the signing secrets live in Vault. Webhook signatures are validated on every inbound provider callback; replay attacks are prevented by storing the provider event ID and rejecting duplicates. Refunds require RBAC `orders.refund` and are themselves audited.

## 11. Privacy & GDPR

The platform collects explicit consent for marketing communications at signup with granular per-channel checkboxes (default off). Users can export their data as a downloadable ZIP (`POST /me/data-export` enqueues a job; signed URL emailed when ready) and can request account deletion (`POST /me/delete-account`) which soft-deletes the user, anonymises PII fields, and retains the audit trail per legal-hold rules. Data Processing Agreements (DPAs) are in place with all subprocessors (Stripe, SendGrid, Twilio, Sentry, Datadog, Atlas). A subprocessor list is published at `/legal/subprocessors`. Cookie consent banner with categorical opt-in for analytics and marketing cookies; strictly necessary cookies do not require consent.

## 12. Dependency & Supply-Chain Security

Dependabot enabled on the monorepo with auto-PR for security patches. `npm audit` and Snyk gate the CI pipeline; critical vulnerabilities block merge. Container base images use distroless Node or Alpine with pinned digests; rebuilt weekly. Container images are signed (cosign) and verified at admission by Kubernetes. SBOM generated per build with Syft; stored alongside release artefacts.

## 13. Infrastructure Security

VPC with private subnets for databases and workers; only the load balancer is internet-facing. Security groups follow least-privilege. SSH access is replaced by Session Manager (AWS) or IAP (GCP); no bastion hosts with persistent credentials. IAM roles for service-to-service auth; no long-lived access keys. Mandatory MFA on cloud-console human users. CloudTrail / Audit Logs enabled and shipped to a separate logging account.

## 14. Application Security Testing

Static analysis (SAST) via Semgrep with a custom rule set including platform-specific patterns (no `req.body` directly in Mongo queries, no string-concat in template literals, etc.). Dynamic analysis (DAST) via OWASP ZAP nightly against staging. Dependency scanning via Snyk. Container scanning via Trivy on every image build. Manual penetration test by an external firm before launch and annually thereafter; remediations tracked to closure before sign-off.

## 15. Incident Response

See `07-monitoring/Incident-Response.md` for runbooks. Summary: a documented severity scale (SEV-1 service-down, SEV-2 partial outage, SEV-3 degraded, SEV-4 cosmetic). 24×7 on-call rota for the API and webhook services. Incident commander declared within 5 minutes of SEV-1. Customer communication via status page and per-tenant email within 30 minutes. Post-incident review within 5 business days with a blameless write-up and tracked action items.

## 16. Compliance Mapping

| Control | Standard | Where Implemented |
|---|---|---|
| Encryption in transit | PCI-DSS 4.1, GDPR Art 32 | TLS 1.3 everywhere |
| Encryption at rest | PCI-DSS 3.4, GDPR Art 32 | AES-256 + KMS |
| Access control | PCI-DSS 7, ASVS V4 | RBAC + entitlement |
| Audit logging | PCI-DSS 10, ASVS V7, IRD | `auditLog` collection + WORM backup |
| Vulnerability management | PCI-DSS 6, 11 | Snyk + ZAP + pen test |
| Data minimisation | GDPR Art 5 | Consent gates + retention policy |
| Right to access / delete | GDPR Art 15, 17 | `/me/data-export`, `/me/delete-account` |
| Breach notification | GDPR Art 33 | 72-hour SLA in `Incident-Response.md` |

## 17. Open Risks & Roadmap

CSFLE (client-side field-level encryption) on the most sensitive PII fields is a Phase 1.5 enhancement. Hardware-key MFA (FIDO2/WebAuthn) is planned for v1.2. SOC 2 Type II readiness work begins post-launch. A dedicated DLP (Data Loss Prevention) program for accountant exports is planned for v1.3.
