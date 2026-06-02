# Monitoring & Observability

**Project:** Unified Marketing & E-Commerce Management Platform
**Stack:** Datadog (metrics, traces, logs, RUM, synthetics), Sentry (errors), Prometheus + Grafana (optional self-hosted)
**Version:** 1.0

---

## 1. Observability Strategy

The platform measures itself across the four golden signals — latency, traffic, errors, saturation — at every layer, and overlays domain-specific signals (cart conversion, payment success rate, social-publish failure rate) so a single dashboard tells both the platform-health story and the business story. SLOs convert these signals into measurable promises with error budgets and alerting thresholds.

The pillars are metrics (Datadog StatsD + OpenTelemetry), traces (OpenTelemetry → Datadog APM), logs (Pino → Datadog), real-user monitoring (Datadog RUM on the storefront), synthetics (Datadog Synthetic from three regions), and errors (Sentry).

## 2. SLOs

Service Level Objectives are tracked publicly internally and reviewed monthly with the Project Sponsor.

| SLI | Objective | Window |
|---|---|---|
| API availability (success/total non-5xx) | 99.9% | 30-day rolling |
| API p95 latency (`/api/v1/*` excluding payments) | < 300 ms | 30-day rolling |
| Storefront p95 LCP (RUM) | < 2.5 s on 4G | 30-day rolling |
| Search autocomplete p95 | < 100 ms | 30-day rolling |
| Checkout-to-paid p95 | < 2 s | 30-day rolling |
| Payment webhook ingest success | 99.95% | 30-day rolling |
| Social publish success rate | > 99.5% | 30-day rolling |
| Audit log chain integrity | 100% | continuous |

Error budgets are 1 - SLO of the relevant SLI; budget burn rates drive alert severity (a 2-hour 14.4× burn fires Sev-2, a 6-hour 6× burn fires Sev-3).

## 3. Dashboards

The Datadog dashboards are organised hierarchically.

**Platform overview** — single screen with the SLI gauges, budget burn, deploy markers, on-call rota, status-page state. Default landing page for the on-call.

**API service dashboard** — per-route p95/p99 latency, request rate, error rate, container CPU/memory, EKS pod count, Mongo connection pool utilisation, Redis hit rate.

**Storefront dashboard** — RUM LCP/INP/CLS by page, JS error rate, navigation timing, CDN cache-hit ratio.

**Payment dashboard** — success rate by gateway (eSewa, Khalti, Stripe, PayPal, COD), failure reasons breakdown, average amount, refund rate, abandoned-checkout rate.

**Inventory & orders dashboard** — orders per hour, p95 fulfilment time (paid → shipped), low-stock count, overselling count (should always be zero), return rate.

**Social dashboard** — posts scheduled/published/failed per hour, inbox depth per channel, SLA breach count.

**Premium accounting dashboard** — auto-posted journals per hour, balance check pass rate (should always be 100%), tax-return generation latency, audit-pack export count, chain integrity status.

**Subscription dashboard** — active subscriptions, MRR, ARR, churn, dunning queue depth.

**Infrastructure dashboard** — node count by group, autoscaler events, EKS control-plane health, Atlas cluster metrics, ElastiCache metrics, S3 request rates.

## 4. Metrics

Standard application metrics (request rate, latency, error rate, dependency latency, queue depth) are emitted automatically by the Datadog Agent's APM tracer.

Business metrics are emitted by domain services via a single helper:

```ts
metrics.increment('order.created', 1, ['tenant:' + tenantId, 'channel:' + channel]);
metrics.histogram('checkout.duration_ms', durationMs, ['method:' + method]);
metrics.gauge('inventory.low_stock_count', count, ['warehouse:' + warehouseId]);
```

Tags are bounded (no unbounded cardinality fields like userId or orderId). Tenant ID is allowed because tenant count is bounded.

## 5. Traces

OpenTelemetry tracer attached to Express, Mongoose, Redis, BullMQ, and external HTTP clients. Sampling at 100% in dev, 25% in staging, 10% in prod with a 100% boost on errors and on a list of priority endpoints (auth, checkout, payment, accounting).

Traces carry a `tenantId` tag and a `userId` tag (hashed for privacy) so a single tenant's slowness can be isolated. The web-to-API hop carries the W3C trace-context so a storefront RUM session links to its backend trace.

## 6. Real-User Monitoring (RUM)

Datadog RUM is enabled on the storefront with conservative privacy defaults: user IDs hashed; no auto-capture of input values; PII fields explicitly excluded. Sessions capture LCP, FID/INP, CLS, JS errors, route changes, and synthetic user-actions (`add-to-cart`, `start-checkout`, `complete-checkout`). RUM is sampled at 20% in production.

## 7. Synthetic Monitoring

Datadog Synthetic runs the following checks every 5 minutes from three regions (US-East, EU-West, AP-South):

- `GET /healthz` on the API — assert 200 in under 500ms.
- `GET /` on the storefront — assert 200 and presence of a marker element in under 2 seconds.
- Login + add-to-cart + view-cart browser test on staging weekly; on production monthly using a dedicated synthetic test account.
- Webhook-replay sandbox check: send a synthetic Stripe webhook to the staging webhook endpoint and assert downstream order state.

Synthetic failures fire Sev-3 by default; three consecutive failures escalate to Sev-2.

## 8. Error Tracking

Sentry SDK in every Node and React app with source maps uploaded per release. Sentry projects: `api`, `storefront`, `admin`, `accounting`, `webhook`, `worker`. Issues auto-link to the relevant Datadog trace via the trace identifier. PII is scrubbed by Sentry's data-scrubbing rules — a custom processor strips request bodies entirely and redacts the field list from `Logging.md` §7.

Sentry release tracking ties each issue to the commit that introduced it (via `git blame`-style attribution from source maps) and to the engineer who shipped it for follow-up routing.

## 9. Alerting

Alerts are routed via PagerDuty.

Sev-1 (24×7 page): API availability under 99% for 5 minutes; payment webhook ingest failing; audit chain integrity check failing; any `fatal` log line; Atlas primary failover lasting > 60 seconds; storefront down across all regions.

Sev-2 (24×7 page, can defer 1 hour): API p95 latency over 600 ms for 10 minutes; 14.4× SLO burn over 2 hours; checkout-to-paid success below 95% for 10 minutes; social publish failures over 5% for 10 minutes; queue depth on email/SMS over 10,000 for 10 minutes; Redis eviction rate spike.

Sev-3 (business-hours page, plus channel): 6× SLO burn over 6 hours; one synthetic failing for two consecutive runs; inventory overselling count > 0; subscription dunning queue depth growing.

Sev-4 (channel only): coverage gap, deprecated endpoint hit rate, dependency aging alerts.

Every alert points to its runbook (incident-response per scenario) so the on-call is never alone with the alert.

## 10. On-Call

Two-engineer rotation (primary + secondary) on weekly shifts. The primary acknowledges within 5 minutes (Sev-1) or 15 minutes (Sev-2). The secondary covers if the primary is unreachable. Handover at Monday 09:00 local with a 30-minute review of the last week's incidents and open follow-ups.

On-call engineers carry a runbook (`Incident-Response.md`), access to PagerDuty, Datadog, Sentry, AWS console (read-only for human accounts, write via PAM JIT for break-glass), and the status page admin.

## 11. Status Page

A public status page (Statuspage.io or Cachet) reflects the current availability of the major subsystems: storefront, admin, payments, social, accounting, notifications. Incidents are posted within 30 minutes of declaration with a brief description, scope, and updates every 30 minutes until resolution.

## 12. Post-Incident Review

Within 5 business days of any Sev-1 or Sev-2 incident, the incident commander leads a blameless post-incident review. The output is a one-page write-up: timeline, root cause, contributing factors, customer impact, what went well, what didn't, action items with owners and due dates. The write-up is shared with the engineering team and the Project Sponsor and archived in the team wiki. Action items are tracked to closure in the next sprint planning.

## 13. Capacity Planning

The DevOps Lead reviews capacity monthly:

- Atlas cluster size against current connection pool, working-set size, and growth trajectory.
- Redis memory usage and eviction rate.
- EKS node count and the autoscaler's behaviour during last month's peak.
- BullMQ queue depths and worker scaling.
- S3 storage and request-rate billing.

Findings drive vertical-scale or sharding decisions before saturation is reached. The review is filed quarterly with the Project Sponsor.

## 14. Compliance Monitoring

The audit-log chain integrity check is a continuous Datadog Monitor on a heartbeat metric emitted by a scheduled job that recomputes the SHA-256 chain on the last hour of entries. A failure fires Sev-1 immediately.

GDPR data-subject-request fulfilment is tracked: the time between request and fulfilment must be under the legal window (30 days). A dashboard surfaces the open queue and the oldest open request.

## 15. Cost Monitoring

A weekly cost report from Datadog and AWS Cost Explorer surfaces anomalies. A 20% week-over-week increase in any line item is investigated. The DevOps Lead presents the monthly cost summary at the sprint review.
