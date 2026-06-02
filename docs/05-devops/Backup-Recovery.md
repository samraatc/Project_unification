# Backup & Disaster Recovery

**Project:** Unified Marketing & E-Commerce Management Platform
**RPO:** ≤ 1 hour | **RTO:** ≤ 4 hours
**Version:** 1.0

---

## 1. Objectives

The platform commits to a Recovery Point Objective (RPO) of one hour or less — at most one hour of data loss in the worst-case disaster — and a Recovery Time Objective (RTO) of four hours or less — the platform is back online within four hours of a disaster declaration. Premium accounting data carries a stricter RPO of 15 minutes given its regulatory and financial sensitivity.

## 2. Data Inventory & Classification

| Data Class | Storage | Sensitivity | Retention | Backup Cadence |
|---|---|---|---|---|
| Operational (orders, products, users, carts) | MongoDB Atlas | Confidential | Active tenant + 7 yrs after closure | Continuous PIT + nightly snapshot |
| Premium Accounting (journals, lines, periods) | MongoDB Atlas | Confidential, Regulated | Indefinite | Continuous PIT + nightly snapshot |
| Audit Log | MongoDB (immutable replica) + S3 WORM | Highly Confidential | Indefinite | Append-only stream + nightly snapshot |
| Sessions, cart cache | Redis | Transient | TTL ≤ 30 days | Not backed up (rebuildable) |
| Product images, social assets | S3 (media bucket) | Public | Indefinite | Versioning + cross-region replication |
| Invoices, audit packs | S3 (private bucket) | Confidential | 10 yrs | Versioning + cross-region replication |
| Application logs | Datadog | Internal | 30 days | Datadog managed |
| Secrets | Vault | Highly Confidential | Until rotated | Vault snapshot daily |

## 3. Backup Strategy

### 3.1 MongoDB Atlas

Atlas Continuous Cloud Backup is enabled on all production clusters. Point-in-Time Recovery covers the past 7 days at second-level granularity. Snapshot retention: 24 hourly snapshots, 7 daily, 5 weekly, 12 monthly. Cross-region snapshot copy to a second region for DR. Backups encrypted with a dedicated KMS key.

### 3.2 Redis

Redis is not backed up. Cart, sessions, and queues are treated as transient. On a total Redis loss, the application degrades gracefully: sessions are re-established by users; carts are re-populated when users next visit; queued jobs are replayed from the durable source-of-truth tables (notification outbox, payment events, audit-log replication queue). ElastiCache automated daily snapshots are nonetheless enabled for fast recovery in non-disaster scenarios.

### 3.3 S3

All production S3 buckets have versioning enabled. The audit and invoice buckets use Object Lock in Compliance mode for the legally required retention window (10 years). Cross-region replication mirrors to a DR region with replication-time-control SLA. Lifecycle rules transition older versions to Glacier after 90 days.

### 3.4 Secrets

Vault snapshots run daily, encrypted with a separate KMS key, and stored in a dedicated S3 bucket with cross-region replication. The Vault unseal keys are split via Shamir's Secret Sharing across multiple custodians with documented chain-of-custody.

### 3.5 Configuration & Code

Git is the source of truth for application code and IaC. The GitHub organisation has a mirror with daily pulls to a separate cloud account for redundancy. Helm chart values and ArgoCD manifests live in the same repo and are part of the mirror.

## 4. Disaster Scenarios & Response

### 4.1 Application Tier Failure (single AZ)

**Impact.** Partial pod loss, automatic Kubernetes reschedule within minutes.
**Detection.** Datadog alert on pod readiness < threshold; PagerDuty fires.
**Recovery.** Automatic — Kubernetes reschedules to surviving AZs. On-call confirms HPA scaled correctly, no customer-facing impact within minutes.

### 4.2 Database Failover (intra-region)

**Impact.** 10–60 seconds of write errors during automatic primary election.
**Detection.** Atlas alert + Datadog API error-rate spike.
**Recovery.** Atlas elects a new primary; the Mongoose driver reconnects with retryable writes. On-call verifies write success post-election, reviews any failed transactions in the dead-letter queue, replays where safe.

### 4.3 Database Corruption / Bad Migration

**Impact.** Data integrity event affecting one or more collections.
**Detection.** Application errors, audit-log anomalies, or operator notice.
**Recovery.** Declare incident (Sev-1 if customer-facing). Determine the last known-good Point-in-Time. Restore from Atlas PIT into a parallel cluster. Validate via audit-log chain recomputation and a sample of high-value records. Cut over the application to the restored cluster via DNS / connection string. Document the timeline. RTO target: 2 hours for partial restore, 4 hours for full restore.

### 4.4 Region Outage

**Impact.** Full primary-region outage; all customer-facing services down.
**Detection.** AWS/GCP Service Health Dashboard, multi-region synthetic monitor (Datadog), customer reports.
**Recovery.** Declare Sev-1. Promote the DR region:

1. Promote Atlas cross-region replica to primary (Atlas Console or CLI).
2. `terraform apply` the DR region root module — EKS cluster, ingress, secrets, observability come up.
3. ArgoCD points at the DR region kubeconfig; sync the production application set.
4. Update Cloudflare DNS to point to the DR region's load balancer.
5. Replay any in-flight webhooks from provider replays (Stripe/eSewa/Khalti webhook replay endpoints).
6. Communicate via status page and per-tenant email at each milestone.

RPO target: 1 hour (last cross-region snapshot). RTO target: 4 hours. The DR procedure is rehearsed quarterly.

### 4.5 Total Cloud Account Compromise

**Impact.** Worst-case: an attacker with root access in the cloud account.
**Detection.** GuardDuty / Security Command Center alerts, anomalous CloudTrail activity.
**Recovery.** Declare Sev-1. Invoke break-glass procedure: revoke the compromised credentials, lock down all IAM roles, rotate every secret in Vault, audit CloudTrail for the duration of the compromise window. Restore data from cross-account backups in the security-hardened mirror account. Customer notification within 72 hours per GDPR. Forensic investigation by an external firm.

### 4.6 Subprocessor Outage

**Impact.** Depends on subprocessor — Stripe outage means card payments fail; SendGrid outage means transactional emails delay; Atlas outage is handled in 4.3.
**Detection.** Subprocessor status page + synthetic monitor.
**Recovery.** Documented per subprocessor. For payments: customer-facing message advises alternative method; orders held Pending with a retry link for 24h. For email: messages queued in `notificationOutbox`; the worker exponential-backoff retries up to 24h. For SMS: same; with a fallback provider configured.

## 5. Restore Procedures

### 5.1 Mongo PIT Restore (Atlas)

```
# Trigger via Atlas Admin API or CLI
atlas backups restores start automated   \
  --clusterName platform-prod           \
  --pointInTimeUTC 2026-06-01T14:30:00Z \
  --targetClusterName platform-prod-pit-2026-06-01
```

Restoration creates a new cluster, leaving the original untouched. Validate restored data via the audit-log chain check and sample validation queries. Cut over by updating the application's `MONGODB_URI` secret in Vault and restarting workloads.

### 5.2 S3 Object Restore

For accidental deletes, restore the previous version via the versioning console or `aws s3api list-object-versions` + `aws s3api copy-object`. For lifecycle-archived objects in Glacier, initiate a restore (`aws s3 restore-object`) with Bulk (5–12 hours) or Standard (3–5 hours) tier as appropriate.

### 5.3 Vault Restore

Restore from the latest Vault snapshot in the DR bucket. Requires the Shamir custodians to be available for unseal. Documented in the on-call runbook with custodian contact information.

## 6. Drills

A DR drill is executed quarterly. The drill alternates between scenarios from Section 4 (database corruption, region outage, S3 accidental delete). Each drill produces a written record with: start time, declared scenario, observed RTO, observed RPO, surprises encountered, action items.

A read-only DR readout is published to the engineering team and the Project Sponsor monthly summarising backup verification status, last drill outcome, and any open action items.

## 7. Verification

Every backup is verified within 24 hours of creation. For Atlas, the verification is a snapshot consistency check (run by Atlas automatically; reported in the Atlas Activity Feed). For S3, the verification is a sample object restore and checksum compare. For Vault, the verification is a daily test-restore into a sandbox Vault and a known-record probe.

Audit-log chain integrity is verified weekly by recomputing the SHA-256 chain over the entire log and comparing to stored hashes.

## 8. Roles & RACI

| Activity | Accountable | Responsible | Consulted | Informed |
|---|---|---|---|---|
| Backup configuration | DevOps Lead | DevOps | Security | All Eng |
| Daily backup verification | DevOps on-call | DevOps on-call | — | DevOps Lead |
| DR drill execution | DevOps Lead | DevOps + App Leads | Security | Sponsor |
| Sev-1 DR invocation | Incident Commander | On-call | Sponsor, Legal | Customers |
| Customer notification | PM / PO | Sponsor | Legal | Customers |
| Forensic investigation | Security Lead | External firm | Legal | Sponsor |

## 9. Compliance Mapping

The backup and DR programme supports GDPR Article 32 (security of processing), Nepal IRD audit-trail retention, and PCI-DSS 9.5 (offsite backup). The 10-year retention on invoices and audit packs satisfies typical fiscal-record retention requirements; consult counsel for the final per-jurisdiction figure.

## 10. Open Items

Multi-region active-active deployment is on the post-launch roadmap (would reduce RTO to minutes). Automated DR-restore rehearsal in CI (using anonymised snapshots in an isolated account) is planned for v1.2. Customer-facing data export portal — beyond per-user export — for enterprise tenants is on the v1.1 roadmap.
