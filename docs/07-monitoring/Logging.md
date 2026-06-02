# Logging

**Project:** Unified Marketing & E-Commerce Management Platform
**Logger:** Pino (Node) with `pino-pretty` in development, structured JSON in all other environments
**Destination:** Datadog Log Management via the Datadog Agent
**Version:** 1.0

---

## 1. Principles

Logs serve three purposes: debugging an incident, reconstructing a sequence of events, and observing trends. To serve all three, every log line is structured JSON, every line carries a request and trace identifier, every line declares its severity, and every line is searchable on the fields a human or alerting rule will actually filter by.

Logs are not used for security audit (the `auditLog` collection is). Logs are not used for billing (events to billing are explicit). Logs may capture enough context to diagnose a problem, never enough to leak PII.

## 2. Log Schema

Every log entry conforms to the following shape:

```json
{
  "ts": "2026-06-01T14:32:17.123Z",
  "level": "info|debug|warn|error|fatal",
  "msg": "Short human summary",
  "service": "api|webhook|worker-email|...",
  "env": "prod|staging|dev",
  "requestId": "01HXX...",
  "traceId": "0af7651916cd43dd8448eb211c80319c",
  "spanId": "b7ad6b7169203331",
  "tenantId": "...",
  "userId": "...",
  "route": "GET /api/v1/orders/:number",
  "statusCode": 200,
  "durationMs": 142,
  "extra": { /* event-specific structured data */ }
}
```

Reserved fields are populated automatically by middleware; `extra` is for event-specific data the caller chooses to log.

## 3. Levels

`fatal` — the process is going to exit; emit just before crash. `error` — an unhandled exception, an unrecoverable error, a 5xx response, a webhook signature failure. `warn` — a degraded path: retry happened, fallback used, deprecated endpoint hit, near-rate-limit. `info` — request lifecycle, business event boundaries (order created, order paid). `debug` — diagnostic detail; off in production by default, switchable per pod via a label-driven config.

A log line at level `info` or higher is permitted; `debug` is filtered out in prod unless explicitly enabled for an incident.

## 4. Request Lifecycle Logging

Every HTTP request emits an `info` line at completion with method, path, status, duration, byte size, tenant, user. The request identifier (`requestId`) is generated at the edge (Cloudflare or ALB) and propagated through the API and any worker enqueued during the request. Every log line emitted during the request includes the request identifier.

The same applies to BullMQ jobs: an `info` line on start, an `info` or `warn` or `error` line on completion with duration, attempt count, and final status. The originating request identifier travels with the job payload so worker logs correlate to the source request.

## 5. Domain Event Logging

Business events are logged at boundary transitions: order created, payment initiated, payment confirmed, payment failed, order status transition, refund issued, social post scheduled, social post published, social post failed, subscription activated, subscription downgraded, low-stock detected.

These are emitted at `info` with a stable `event` key (e.g., `event: "order.payment.confirmed"`) so dashboards and alerts can index on them. The same events also drive the audit log; logging is the lossy human-readable trace, the audit log is the authoritative record.

## 6. Error Logging

Unhandled errors emit `error` with the stack, the request identifier, and the relevant context (entity IDs, route). Sentry receives the same error with source maps for stack symbolication. Error logs never include unredacted request bodies; sensitive fields are stripped by the logger's middleware before serialisation.

A 4xx response does not log at `error`. Validation failures and `403 Forbidden` log at `info` so dashboards can spot unusual user behaviour (rate of 401s climbing is interesting) without polluting the error stream.

## 7. PII & Secret Redaction

The logger is configured with a fixed list of field names that are redacted to `***` before serialisation:

`password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `bearer`, `authorization`, `secret`, `apiKey`, `card`, `cardNumber`, `cvv`, `pan`, `ssn`, `2faSecret`, `backupCodes`, `email`, `phone`, `address`, `dob`.

Email and phone are not absolute secrets but are redacted by default to minimise PII exposure in operational logs; if a specific diagnostic needs them, the engineer explicitly opts in with a justification recorded in the code.

The redaction is applied at the logger level, before any transport sees the payload. A unit test asserts redaction on every field for every level.

## 8. Trace Correlation

The platform uses OpenTelemetry for tracing. The W3C `traceparent` header propagates a trace identifier through every HTTP hop and is captured in every log line. Datadog APM ingests both logs and traces; the UI links from a log line to its trace and from a trace span to its logs.

## 9. Log Volume & Retention

Production log volume is budgeted at ≈ 500 MB/day per million requests (after PII redaction and `debug` filtering). Retention: 30 days hot in Datadog Logs (fast search), 90 days warm (archived to S3 with replay capability), 12 months cold (Glacier; only restored on compliance or incident demand).

Application logs are not used for audit purposes; the audit log retention (indefinite) is independent.

## 10. Sensitive Endpoints

Authentication endpoints (`/auth/*`) log only the identifier, the result (success / failure reason), the IP, and the user-agent. Bodies are never logged. Payment endpoints log only the gateway reference and the amount; card data is unreachable by design. Accounting endpoints log only metadata (entity ID, action, actor); the full before/after diff lives in the audit log, not the operational log.

## 11. Log Sampling

Most logs are not sampled. High-volume health-check endpoints (`/healthz`, `/ready`) are sampled at 1% to reduce volume without losing signal. Sampled lines carry `sampled: true` so dashboards can compensate.

## 12. Local Development Logging

In development, logs use `pino-pretty` with colourised output and human-readable timestamps. Sensitive-field redaction still applies. The log level defaults to `debug` in dev, `info` in staging and prod.

## 13. Querying

Common Datadog log queries are saved as views:

- "All 5xx in prod last hour" — `env:prod status:>=500`.
- "Payment failures by gateway" — `env:prod event:payment.failed | group_by gateway`.
- "Webhook signature failures" — `env:prod service:webhook event:webhook.invalid_signature`.
- "Slow requests" — `env:prod durationMs:>1000`.
- "Per-tenant error rate" — `env:prod level:error | group_by tenantId`.

The on-call runbook references these queries for each common incident class.

## 14. Alerts on Logs

Some alerts trigger on log patterns rather than metrics: a spike in `webhook.invalid_signature` (possible attack); any `fatal` line (process crash); a spike in `auth.lockout.triggered` (possible credential stuffing); any `accounting.chain.integrity_failed` line (audit chain tampering — Sev-1). Alert thresholds and routing are in `Monitoring.md`.

## 15. Compliance

Operational logs are not regulated artefacts. They may not contain PII or financial data sufficient for regulator-style analysis. The audit log (covered in Security and Architecture documents) carries that responsibility separately.
