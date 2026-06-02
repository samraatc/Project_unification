# Privacy Policy

**Operator:** Elskov Services
**Product:** Unified Marketing & E-Commerce Management Platform ("the Platform")
**Effective date:** [to be set on launch]
**Last updated:** [to be set on launch]
**Document version:** 1.0 (draft pending legal review)

> This is a starting draft prepared by the engineering and product teams. It must be reviewed and approved by qualified legal counsel before being published. Final language, jurisdiction-specific clauses, and binding terms are the responsibility of legal counsel.

---

## 1. Introduction

This Privacy Policy describes how Elskov Services ("we", "us", "our") collects, uses, shares, and protects personal data when you use the Platform, including the storefront, admin console, accounting portal, and any related APIs and applications. By using the Platform, you agree to the practices described in this Policy.

This Policy is written to align with the EU General Data Protection Regulation (GDPR), the UK GDPR, and applicable data-protection laws in Nepal and other jurisdictions where the Platform is offered. Where local law provides stronger protection, we follow local law.

## 2. Who We Are

Elskov Services is the data controller for personal data collected via the Platform. Where the Platform is used by a business customer ("tenant") to manage their own end customers, the tenant is the controller for those end customers' personal data and we act as a data processor under a Data Processing Agreement.

Contact for privacy enquiries: `privacy@elskov.example` (to be updated to the production address on launch).

## 3. What We Collect

We collect personal data in three categories.

**Data you provide.** Account information (name, email, phone, password hash, date of birth, gender), profile information (avatar, addresses up to 5 labelled entries, linked eSewa/Khalti wallet identifiers, notification preferences), commerce information (cart contents, orders, returns, reviews, wishlist), social-media information (handles, post drafts, inbox messages exchanged with tenant accounts), and accounting information (invoices, tax records — for tenants on the Premium tier).

**Data collected automatically.** Device and connection information (IP address, user-agent, language, time zone), usage information (pages viewed, products searched, click patterns), authentication metadata (login timestamps, IPs, sessions, 2FA enrolment status).

**Data from third parties.** Authentication data from OAuth providers (Google, Facebook) when you choose social sign-in; payment status and tokens from payment gateways (Stripe, eSewa, Khalti, PayPal); courier scan events from delivery partners (Pathao, Aramex); social platform data from Meta and TikTok APIs when tenants connect their accounts.

We do not collect or store card numbers, CVV, or full payment instrument details. Card data is captured directly by the payment gateway via tokenised elements and never reaches our servers.

## 4. Why We Collect It (Legal Bases)

We process personal data on the following legal bases under GDPR Article 6.

**Contract.** To create and operate your account, fulfil orders, deliver receipts, provide customer support, and enable tenant administrators to operate their business.

**Legal obligation.** To meet tax, invoicing, anti-fraud, and accounting record-retention obligations (notably the Nepal IRD and equivalent foreign tax authorities).

**Legitimate interest.** To operate, secure, monitor, and improve the Platform; to detect and prevent fraud, abuse, and security incidents; to maintain audit trails for accounting integrity.

**Consent.** For marketing communications, optional analytics cookies, and any processing that is not necessary for the contract or legal compliance. Consent can be withdrawn at any time via the in-product preferences.

## 5. How We Use It

We use personal data to provide and improve the Platform, including: authenticating users; fulfilling orders and arranging delivery; processing payments and refunds; sending transactional notifications (email, SMS, push) for orders, returns, security events, and account changes; enabling tenants to publish and manage social-media content and inbox replies; generating accounting records and tax filings for tenants on the Premium tier; producing aggregated, non-identifying analytics; detecting and preventing fraud, abuse, and security incidents; maintaining an immutable audit trail of platform activity; and complying with legal obligations.

We do not use personal data for automated decision-making with legal or similarly significant effects on you. Anti-fraud systems may flag suspicious transactions for human review.

## 6. Sharing & Subprocessors

We share personal data with the following categories of third parties, each governed by a Data Processing Agreement where applicable.

**Cloud infrastructure** — AWS or GCP (compute, storage, databases) and MongoDB Atlas (managed database).

**Payment processors** — Stripe, eSewa, Khalti, PayPal — for payment authorisation, capture, refunds, and subscription billing.

**Communication providers** — SendGrid (email), Twilio and Sparrow SMS (SMS), Firebase Cloud Messaging (push).

**Couriers** — Pathao, Aramex — for delivery and tracking.

**Social platforms** — Meta (Facebook + Instagram), TikTok — for content publishing, inbox aggregation, and analytics on tenant-connected accounts.

**Operational tooling** — Sentry (error tracking, PII scrubbed), Datadog (observability, PII redacted), Cloudflare (CDN, WAF).

A live list of subprocessors with their roles and locations is maintained at `[/legal/subprocessors]`. We notify tenants at least 30 days before adding a new subprocessor where they have a Premium or Enterprise plan.

We do not sell personal data. We do not share personal data with advertisers.

## 7. International Transfers

Personal data may be transferred to and processed in countries outside your country of residence. Where personal data is transferred out of the European Economic Area, the United Kingdom, or other jurisdictions with cross-border transfer restrictions, we rely on the European Commission's Standard Contractual Clauses or equivalent safeguards. Enterprise tenants can request data residency pinning to a specific cloud region.

## 8. Retention

We retain personal data only as long as necessary for the purposes described in this Policy and to comply with our legal obligations.

Account data is retained while the account is active and for a reasonable period thereafter to fulfil legal obligations. Orders and related transactional data are retained for at least 7 years to satisfy accounting and tax-record requirements; the Nepal IRD and equivalent foreign tax authorities require retention of accounting records for set periods which override shorter retention windows. Audit-log entries in the Premium Accounting module are retained indefinitely as required by accounting integrity standards. Marketing data tied to consent is retained until consent is withdrawn. Transient operational data (cart, session, cache) is retained for short configurable windows and is not used for analytics or marketing.

When personal data is no longer needed and is not subject to a retention obligation, we delete or anonymise it.

## 9. Your Rights

Subject to applicable law and identity verification, you have the following rights.

**Access.** Request a copy of the personal data we hold about you, delivered as a downloadable ZIP via the in-product data-export tool.

**Rectification.** Correct personal data through your profile settings or by contacting privacy support.

**Erasure ("right to be forgotten").** Request deletion of your account and personal data. We will soft-delete your account, anonymise PII fields, and retain only the data required to meet legal obligations (e.g., accounting records). Where retention is required, we explain why and for how long.

**Restriction.** Request that we restrict processing while a dispute is resolved or in other circumstances permitted by law.

**Portability.** Receive personal data you have provided in a structured, commonly used, machine-readable format.

**Objection.** Object to processing based on legitimate interest. Where we cannot demonstrate compelling legitimate grounds, we will stop the relevant processing.

**Withdraw consent.** Withdraw consent at any time for processing based on consent. This does not affect the lawfulness of processing carried out before withdrawal.

**Complain.** Lodge a complaint with your local data-protection authority.

To exercise any of these rights, use the in-product tools where available or contact `privacy@elskov.example`. We respond within 30 days; in complex cases we may extend by up to 60 days and will inform you.

## 10. Security

We protect personal data with administrative, technical, and physical safeguards. Data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is governed by role-based access control with deny-by-default policies. Sensitive operations require multi-factor authentication. We maintain an immutable audit trail of platform activity. We engage external firms for annual security testing. Despite our efforts, no system is perfectly secure; in the event of a breach affecting personal data, we will notify affected users and authorities as required by law (within 72 hours under GDPR Article 33 where applicable).

A summary of our security practices is available in `04-security/Security-Requirements.md`.

## 11. Cookies & Similar Technologies

We use cookies and similar technologies to operate the Platform and, with consent, for analytics. Strictly necessary cookies (authentication, session) do not require consent. Analytics and marketing cookies are only set after explicit opt-in via the cookie banner. You can change your preferences at any time via the cookie settings link in the footer.

## 12. Children

The Platform is not intended for children under 16 (or the equivalent age of digital consent in your jurisdiction). We do not knowingly collect personal data from children. If you believe a child has provided personal data, contact us and we will delete it.

## 13. Changes to This Policy

We may update this Policy as the Platform evolves or as legal requirements change. Material changes will be communicated in advance via email and an in-product notice at least 30 days before they take effect. The "Last updated" date at the top reflects the current version.

## 14. Contact

For privacy questions or to exercise your rights, contact `privacy@elskov.example`. For security concerns, contact `security@elskov.example`.

[Placeholder: registered company name, registered office, applicable Data Protection Officer contact where required, supervisory authority of the lead establishment.]
