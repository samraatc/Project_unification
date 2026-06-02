# Infrastructure

**Project:** Unified Marketing & E-Commerce Management Platform
**Cloud:** AWS (primary) — GCP equivalents noted where relevant
**IaC:** Terraform 1.7+
**Version:** 1.0

---

## 1. Cloud Selection

The plan supports both AWS and GCP; the primary deployment described here is AWS. The equivalent GCP service is noted in parentheses where the choice affects design. The decision between providers is made by the Project Sponsor at Phase 0 based on existing commercial agreements, region availability for the target customer base, and integration with the chosen managed services (in particular MongoDB Atlas, which is multi-cloud and treats both providers equivalently for our workload).

## 2. Environments

Three permanent environments and on-demand ephemeral previews per PR.

**Development.** Single-AZ, smaller node sizes, no autoscaling. Used for engineer-level integration testing. Sample seed data; no real customer data.

**Staging.** Mirrors production topology at smaller scale (multi-AZ, autoscaling enabled). Real third-party sandbox credentials (Stripe test, eSewa sandbox, Khalti sandbox). Used for QA, security scanning, performance load tests, and UAT.

**Production.** Multi-AZ within a single region for v1; documented DR plan to a second region. Full observability, alerting, backups.

**Preview.** Per-PR ephemeral environment provisioned by the CI pipeline. Spun up on PR open, torn down on merge or PR close. Uses minimal sizing and shares no data with staging or production.

## 3. AWS Topology

The production VPC is structured as follows.

```
VPC 10.0.0.0/16  (3 AZs)
├── Public subnets    10.0.0.0/22    — ALB, NAT gateways
├── Private app       10.0.4.0/22    — EKS worker nodes (API, web, workers)
├── Private data      10.0.8.0/22    — ElastiCache, internal services
└── Private mgmt      10.0.12.0/22   — bastion (Session Manager), monitoring
```

**Edge.** Cloudflare for DNS, WAF, and DDoS. CloudFront CDN in front of the storefront for static assets and SSR cache. ALB (Application Load Balancer) terminates TLS to the cluster.

**Compute.** EKS cluster running Kubernetes 1.29+ across three AZs. Three node groups: `general` (API, web, workers), `memory` (BullMQ heavy workers), `spot` (preview environments only). Cluster autoscaler enabled.

**Database.** MongoDB Atlas multi-region cluster, M30 tier at launch (sized for ~50k MAU), with vertical-scale path through M40 → M60. Atlas Search enabled on the same cluster. Connection from EKS via VPC peering (PrivateLink optional).

**Cache & Queue.** Amazon ElastiCache for Redis 7, cluster-mode-enabled (single shard at launch; reshardable). Used for sessions, cart cache, RBAC permission cache, entitlement cache, BullMQ backplane, Socket.IO pub/sub.

**Object Storage.** S3 buckets: `platform-media-prod` (product images, social assets, public; CloudFront-fronted), `platform-invoices-prod` (private, KMS-encrypted), `platform-audit-prod` (WORM, Object Lock Compliance mode), `platform-backups-prod` (versioned, lifecycle to Glacier).

**Email/SMS/Push.** SendGrid, Twilio, Sparrow SMS, Firebase Cloud Messaging — external SaaS, no infrastructure.

**Secrets.** HashiCorp Vault (or AWS Secrets Manager). KMS keys for envelope encryption.

**Observability.** Datadog Agent on every node; Sentry SDK in every app; OpenTelemetry collector forwarding traces to Datadog APM; CloudWatch for AWS service metrics.

**CI/CD.** GitHub Actions runners (managed). Self-hosted runners only for jobs that need VPC access (Terraform plan/apply).

## 4. GCP Equivalents

If GCP is selected, the mapping is: EKS → GKE Autopilot or Standard; ALB → Google Cloud Load Balancing; ElastiCache → Memorystore for Redis; S3 → Google Cloud Storage; CloudFront → Cloud CDN; CloudWatch → Cloud Monitoring; KMS → Cloud KMS; ACM → Google-managed certificates. MongoDB Atlas is identical on either cloud.

## 5. Kubernetes Layout

Each application is a Helm chart. Naming convention: `platform-<app>`.

- `platform-api` — Deployment + HPA, 3 replicas baseline, scale to 20 on CPU > 70% or request rate > 500 rps. Service type ClusterIP behind ALB Ingress.
- `platform-storefront` — Deployment + HPA, 3 replicas, scales on CPU and active SSR connections.
- `platform-admin` — Deployment, 2 replicas (lower traffic).
- `platform-accounting` — Deployment, 2 replicas.
- `platform-webhook` — Deployment, 3 replicas, dedicated HPA on request rate.
- `platform-worker-email`, `platform-worker-sms`, `platform-worker-push`, `platform-worker-social`, `platform-worker-accounting`, `platform-worker-dunning`, `platform-worker-search-sync` — Deployments, scale independently per queue depth.
- `platform-socket` — Deployment, 3 replicas, sticky sessions via session affinity (or Redis pub/sub backplane).

Ingress: AWS Load Balancer Controller with one ALB per environment, host-based routing for the three frontends and the API.

Resource requests and limits set per workload from load-test data; HPA targets 70% CPU. PodDisruptionBudget ensures at least 2 replicas during voluntary disruptions.

## 6. Networking

Egress: NAT Gateways in each AZ, 3-way redundancy. VPC Endpoints (Interface) for S3, KMS, Secrets Manager to keep traffic off the public internet.

Ingress: ALB with WAF (AWS WAF or Cloudflare in front), TLS termination, HTTP/2. Health checks against the API's `/healthz`.

Internal: Pod-to-pod via cluster DNS; service mesh deferred to post-launch (Istio or Linkerd as a future enhancement).

DNS: Cloudflare for public DNS with proxied A records pointing to CloudFront and ALB. CAA records pinning ACM and Cloudflare as the only allowed issuers.

## 7. Terraform Layout

```
/infra/terraform
├── modules
│   ├── network     (VPC, subnets, NAT, route tables)
│   ├── eks         (cluster, node groups, IAM)
│   ├── redis       (ElastiCache)
│   ├── s3          (buckets with policy + lifecycle)
│   ├── waf         (rule sets)
│   ├── kms         (keys + rotation)
│   ├── secrets     (Vault or Secrets Manager)
│   └── observability (Datadog integration, CloudWatch)
├── envs
│   ├── prod        (terraform.tfvars + state backend)
│   ├── staging
│   └── dev
└── shared          (cross-env resources: Cloudflare zone, Route53, Atlas org)
```

State stored in S3 with DynamoDB locking. State files encrypted with a dedicated KMS key. CI applies via OIDC-federated AWS role (no static keys).

## 8. Scaling Plan

Storefront and API HPA scale on CPU and request rate. EKS cluster autoscaler scales node groups when pods cannot be scheduled. Redis is cluster-mode-enabled and can be resharded online. Mongo Atlas vertical scale takes minutes with brief failover; sharded cluster planned only when single-shard write throughput is exceeded (well above v1 projections).

Flash-sale playbook: pre-warm the API HPA by 24h scheduled scale, pre-warm Redis, set ALB pre-warming with AWS support, raise BullMQ concurrency on the order-processing worker, set a higher Atlas connection pool ceiling.

## 9. Cost Notes

Year-1 infrastructure budget (Master Plan Section 11.2): cloud compute + DB + CDN + S3 of USD 12–24k; managed Postgres+Redis+Search (we use Mongo Atlas instead, similar bracket) of USD 6–9k; email/SMS/push USD 1.8–4.8k; monitoring USD 3–6k; domain/SSL/WAF/DNS USD 1.2k; security pen test one-off USD 8–15k. Estimated total USD 32–60k excluding payment fees.

Cost controls: spot instances on preview environments only; right-size monthly with the Datadog cost insights or AWS Compute Optimizer; S3 lifecycle to Standard-IA after 30 days, Glacier after 90 days for backups; CloudFront cache hit ratio target ≥ 85% on storefront assets.

## 10. Compliance & Data Residency

Production data resides in the chosen primary region (default `us-east-1` for AWS, `us-central1` for GCP — finalised at Phase 0 with the Project Sponsor based on customer location). The Enterprise plan offers tenant-pinned residency to any of: `us-east-1`, `eu-west-1`, `ap-south-1`, `ap-southeast-1`. Atlas, S3, and Redis honour the chosen region.

## 11. Pre-Production Checklist

Before promoting a release-candidate to production: Terraform plan shows zero unexpected drift; secrets rotated in the last 60 days for any near-expiry credentials; backup restore tested in the past quarter; load test passed at 2× projected peak; DR drill executed in the past quarter; on-call rota covered; status page updated; rollback path documented and tested.
