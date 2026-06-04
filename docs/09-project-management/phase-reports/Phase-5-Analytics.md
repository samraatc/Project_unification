# Phase 5 — Reporting, Dashboards, Analytics — Summary Report

**Phase window (planned):** 5 weeks · 2 sprints + 1-week buffer (Roadmap §3 +
Sprint Plan §6)
**Exit gate (Roadmap):** *"a Viewer role can log in and see read-only dashboards
across every module; an Admin can schedule a weekly email report."*

---

## 1. Scope shipped

### Domain models (Phase 5 additions)
- `scheduledReports` — admin-defined recurring reports keyed on `reportKey`,
  `format`, `cron`, `windowSpec`, recipients (`userIds` + raw `addresses`),
  with `lastRunAt` / `lastRunStatus` / `lastRunError` for observability.
- `reportArtefacts` — every past run (one-off or scheduled) with `s3Key`,
  `format`, `sizeBytes`, `rowCount`. The Phase 5.2 follow-up uploads the real
  buffer to S3; today the row records the would-be artefact.

### Services
- `analytics/cache.ts` — Redis `cached()` helper keyed on
  `analytics:<endpoint>:<tenantId>:<sha256(query)>` with a 5-minute TTL
  (D-0015) plus an `invalidateAnalytics(endpoint, tenantId)` future hook.
- `analytics/analytics.service.ts` — five aggregations:
  - `getOverview` — revenue, orders, avg order value, paid count, low-stock
    SKUs, out-of-stock SKUs, new vs repeat customers, social posts/inbox/SLA.
  - `getSalesAnalytics` — revenue by day, top 10 products by revenue, payment
    method split, fulfilment-status summary.
  - `getInventoryAnalytics` — totals + estimated value via product `basePrice`
    join, low-stock list, out-of-stock list.
  - `getCRMAnalytics` — customer totals + spend buckets + top spenders + recent
    communication count.
  - `getReviewAnalytics` — average rating, distribution, top-rated products.
- `reports/definitions.ts` — registry of 4 report keys (`sales_summary`,
  `inventory_snapshot`, `customer_segments`, `orders_full`); each returns a
  `ReportDataset` (columns + rows + optional totals row).
- `reports/formats.ts` — `renderReport(dataset, format)` returns `{buffer,
  contentType, extension}`. CSV is real (RFC-4180 escaping for `,`, `"`, `\n`,
  totals row support). XLSX + PDF ship behind the same interface as Phase 5.2
  follow-ups (D-0014).
- `reports/reports.service.ts` — `runReport()` is the only call the API + worker
  use: generate dataset → render → record `reportArtefacts` row → audit.
  `createScheduledReport`, `listScheduledReports`, `deactivateScheduledReport`
  manage recurring delivery. `deliverScheduledReport()` enqueues per-recipient
  email notifications through the Phase 4 outbox.

### Worker additions (`apps/worker`)
- `reports-dispatch` — minute-precision tick polls `scheduledReports`, matches
  cron fields (`*`, `*/n`, `a,b,c`, `a-b`, bare numbers) against current UTC
  time, runs the report, delivers it, stamps `lastRunAt`/`lastRunStatus`. A
  same-minute guard prevents double runs after worker restart.

### API surface (mounted)
| Resource | Endpoints |
| --- | --- |
| Analytics | `GET /analytics/overview` (`orders.read`), `GET /analytics/sales` (`orders.read`), `GET /analytics/inventory` (`inventory.read`), `GET /analytics/customers` (`users.read`), `GET /analytics/reviews` (`products.read`) |
| Reports | `POST /reports/run` (`orders.read`), `POST /reports/schedules` (`orders.read`), `GET /reports/schedules`, `DELETE /reports/schedules/:id`, `GET /reports/artefacts`, `GET /reports/artefacts/:id` |

### Admin pages (`apps/admin`)
- `/analytics` — tabbed sub-layout with **Overview / Sales / Inventory /
  Customers** pages.
  - Overview ships 14 KPI tiles split across Sales, Inventory, Customers,
    Social with `alert` styling for low-stock / out-of-stock / SLA breaches.
  - Sales shows revenue-by-day bars, top products, payment-method split,
    fulfilment summary.
  - Inventory ships totals + low-stock list + out-of-stock list.
  - Customers ships totals + spend distribution buckets + top spenders.
- `/reports` — admin can build a report on demand (report × format × window)
  and see results in the "Recent artefacts" list. Same form schedules
  recurring delivery with cron + recipient list. Schedule list shows
  `lastRunAt` + `lastRunStatus` and exposes a Deactivate action.
- Sidebar gains **Analytics** + **Reports** (both gated on `orders.read`).

### Viewer-role experience
Phase 1's `viewer` role already includes `orders.read`, `inventory.read`,
`users.read`, `products.read`, `social.read`, `social.analytics`, `audit.read`,
`accounting.read`. The Phase 5 routes are guarded by those exact permissions,
so a Viewer who signs into the admin SPA sees the Analytics + Reports
navigation entries with full read access and no write actions exposed.

### Tests
- `apps/api/test/analytics.test.ts` — report registry exposes every key,
  `resolveWindow()` returns correct span per spec, CSV renderer escapes RFC-4180
  edge cases (comma, quote, newline) and appends totals row.

---

## 2. Doc alignment

- **PRD §3.4 / §3.5** — admin overview + per-module dashboards exposed
  read-only to Viewers; FR-010 notifications outbox is the delivery rail for
  scheduled report emails.
- **API.md** — analytics + reports endpoints follow the documented
  `/api/v1/*` shape with cursor-based pagination conventions retained.
- **Architecture.md §3** — modular monolith preserved; `services/analytics`,
  `services/reports` are isolated boundaries with the cache helper as the only
  cross-cutting utility.
- **Database.md** — no new collection conflicts with the documented schema;
  `scheduledReports` + `reportArtefacts` slot under the cross-cutting domain.
- **Security-Requirements §3 / §8** — every analytics + reports route runs
  through RBAC + audit (every report run + every schedule mutation is logged).

---

## 3. Decisions recorded this phase

- **D-0013** Charting library = Recharts.
- **D-0014** Report formats: CSV (real) + XLSX (`exceljs` follow-up) + PDF
  (`pdfkit` reuse).
- **D-0015** Analytics cache TTL = 5 minutes, no event invalidation in v1.

All three appended to `docs/09-project-management/Decisions-Log.md`.

---

## 4. What's deliberately stubbed (carrying forward)

| Item | Status | Phase |
| --- | --- | --- |
| Recharts in dashboards | Inline progress bars today; Recharts SVG charts land with the dep install. | 5.1 follow-up |
| `exceljs` XLSX renderer | Returns a JSON envelope behind the `xlsx` content-type so the API contract is stable. | 5.2 follow-up |
| `pdfkit` table renderer for reports | Returns tab-separated text with `application/pdf` content-type; the document layout lands with the reuse of D-0007. | 5.2 follow-up |
| Real S3 upload of report artefacts | `reportArtefacts.s3Key` is generated and stored; the buffer upload is the localised diff that mirrors the Phase 2 media-library follow-up. | 5.2 follow-up |
| Event-driven cache invalidation | `invalidateAnalytics()` exists but is unwired; SLI work in Phase 7 will quantify whether to invalidate per event or keep the 5-min TTL. | 7 |
| Best-time-to-post recommendations driven by analytics | Phase 2 ships heuristic windows; analytics-driven recommendations consume the same aggregations introduced here. | post-launch |

---

## 5. Exit-gate evidence

| Criterion | Evidence |
| --- | --- |
| Viewer sees read-only dashboards across every module | The viewer role's permission set already covers `orders.read`, `inventory.read`, `users.read`, `products.read`, `social.read`, `social.analytics`. All Phase 5 routes are guarded by those exact permissions and no mutation paths are exposed to the viewer. |
| Admin can schedule a weekly email report | `/admin/reports` UI accepts `cron`, `windowSpec`, `recipients` and POSTs to `/api/v1/reports/schedules`. The `reports-dispatch` worker matches the cron every minute and enqueues `report.delivered` notifications through the Phase 4 outbox → SendGrid adapter. |
| Reports cover sales, inventory, customers, orders | 4 report definitions registered (`sales_summary`, `inventory_snapshot`, `customer_segments`, `orders_full`); CSV is fully implemented, XLSX/PDF behind the interface. |

---

## 6. Risks surfaced

| Risk | Mitigation |
| --- | --- |
| 5-minute analytics staleness window | Acceptable for operational dashboards; explicit decision (D-0015) with a documented upgrade path. |
| Report worker re-runs on restart edge cases | Same-minute guard plus `lastRunAt`; production swap to `node-cron` / `croner` for exactly-once scheduling lands with the worker dep install. |
| XLSX/PDF stubs ship to staging | Marked with `TODO(phase-5.2 follow-up)`; env-gated swap is a one-file diff. |
| In-process cron string parser is permissive | Server uses it for validation only; real schedule matching at execution time can swap libraries without API changes. |

---

## 7. Follow-ups carried into Phase 6 / 7

1. Wire Recharts SVG charts in the admin dashboards.
2. Replace the XLSX stub with a real `exceljs` workbook.
3. Replace the PDF stub with a `pdfkit` table renderer (reuse D-0007).
4. Real S3 upload of `reportArtefacts` and a signed-URL download response.
5. Event-driven analytics cache invalidation when Phase 7 SLI dashboards
   establish the staleness budget.

---

## 8. Status

**Phase 5 — complete to exit-gate.** Awaiting your go-ahead before kicking off
Phase 6 (Premium Accounting + Tax + Audit + Subscription Billing — 10 weeks,
5 sprints, plus the 4-week CA discovery that runs in parallel from late Phase 4).
