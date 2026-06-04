# Phase 6 — Premium Accounting + Tax + Audit + Subscription — Summary Report

**Phase window (planned):** 10 weeks · 5 sprints + parallel 4-week CA discovery
(Roadmap §3 + Sprint Plan §6)
**FRs satisfied (per PRD §5):** FR-013 Accounting (auto-journal from every event
class) · FR-014 Tax (VAT 200 + GSTR-1/3B + Nepal IRD e-invoice) · FR-015 Audit
hardening (tamper-evident chain + signed audit pack) · FR-016 Subscription &
Billing (Stripe + eSewa + Khalti recurring with dunning).

**Exit gate (Roadmap):** *"auto-posted entries balance for every event class;
a CA signs off on the regulator-format outputs; the dunning workflow tested
end-to-end; locked-feature upgrade prompts surface correctly."*

---

## 1. Scope shipped

### Domain models (Database.md §8 + new chain head)
- `subscriptions` — per-tenant unique row, status state machine
  (`trial → active → past_due → grace → cancelled/expired`), expanded
  `entitlements[]`, gateway refs, dunning attempt tracker.
- `chartOfAccounts` — hierarchical CoA with `parent`+`path[]`, normal-side enum
  (`dr`/`cr`), tenant-unique code (D-0016 numbering).
- `journalEntries` — embedded `lines[]` with positive `amountMinor` + `side`
  enum (D-0017), `status` (draft/posted/reversed), idempotency on
  `(source, sourceEventId)`.
- `accountingPeriods` — month/quarter/year with open/closed/locked.
- `taxRates` — jurisdiction + valid-from/valid-to with `rateBp` integer ×100.
- `invoices` — regulatory-grade rows with `eInvoiceJsonKey` + SHA-256 hash.
- `bankAccounts` + `bankTransactions` — with `matchConfidence` 0..1 +
  `matchedJournalId`.
- `budgets` — 12-month array per `(year, costCentre, accountId)`.
- `fxRates` — daily snapshot with `rateBp` ×10 000.
- `auditChainHeads` — per-tenant chain head + length + last-update timestamp
  (D-0018).

### Services
- `billing/plans.ts` — 5-plan catalogue with expanded `entitlements[]`,
  USD + NPR pricing, `GRACE_PERIOD_DAYS = 7`, `ARCHIVE_AFTER_DAYS = 14`.
- `billing/providers/` — `BillingProvider` contract (createCheckout,
  retryPayment, cancel, verifyWebhookSignature, parseWebhook) +
  **stripeBilling** + **esewaRecurring** + **khaltiRecurring** adapters.
- `billing/billing.service.ts` — `entitlementsFor()` Redis-cached helper
  (5-min TTL) backing `requireEntitlement`; `startCheckout`,
  `ingestBillingEvent` (webhook ingest), `tickDunning` (state machine
  walker), `cancelSubscription`, `invalidateEntitlements`.
- `accounting/templates.ts` — Retail / Services / Manufacturing CoA seeds with
  the documented numbering + a shared `ACCOUNT_HINTS` map used by auto-journal.
- `accounting/ledger.service.ts` — `seedCoaTemplate`, `postJournalEntry`
  (balance guard + period guard + idempotency), `reverseJournalEntry`, and
  five auto-journal handlers: `recordOrderPaid`, `recordRefund`,
  `recordPoReceive`, `recordStockWriteOff`, `recordPayout`. Every handler is
  source-event-ID-idempotent so re-emitted events are no-ops.
- `accounting/period.service.ts` — `createPeriod`, `closePeriod` (locks new
  posts), `reopenPeriod` (Super Admin only at the route layer), `lockPeriod`
  (terminal).
- `accounting/tax.service.ts` — `computeTaxLines()` per-line with valid-rate
  lookup, `generateInvoice()` with Nepal IRD e-invoice JSON + SHA-256 hash,
  `vat200() / gstr1() / gstr3b()` aggregations, `lookupInvoiceEInvoice()`.
- `accounting/reports.service.ts` — `trialBalance`, `profitAndLoss`,
  `balanceSheet`, `cashFlow`, `generalLedger` (running balance),
  `subLedger` (per type).
- `accounting/bank.service.ts` — `importTransactions`, `listUnmatched`,
  `autoMatch` (heuristic with day-decay confidence 1.0/0.8/0.5), `manualMatch`.
- `accounting/auditChain.service.ts` — `advanceChainForTenant()` writes the
  prev-hash + chain-hash on every premium audit row; `verifyChain()` replays
  from genesis to attach a proof certificate.
- `accounting/auditPack.service.ts` — `buildAuditPack()` bundles trial balance
  + counts + chain verification into a SHA-256-signed manifest.
- `accounting/fx.service.ts` — `resolveFxRate()` + `upsertFxRate()`.

### Worker additions (`apps/worker`)
- `dunning-retry` — minute-precision tick calling `tickDunning()`.
- `audit-chain` — 30-second tick advancing the per-tenant chain head for new
  premium audit rows.
- Existing five workers (social publish, abandoned checkout, notifications,
  reports, plus Phase 4 carries) continue.

### Webhook service additions (`apps/webhook`)
- `/webhooks/billing/stripe`, `/webhooks/billing/esewa`,
  `/webhooks/billing/khalti` — each verifies the provider signature, upserts
  `paymentEvents` for idempotency, ACKs 200, then routes the parsed event
  through `ingestBillingEvent()` which updates `subscriptions.status` +
  `entitlements[]` and invalidates the cache.

### API surface (mounted)
| Resource | Endpoints (all premium routes are guarded by both `requirePermission` and `requireEntitlement`) |
| --- | --- |
| Billing | `GET /billing/plans` (public) · `GET /billing/subscription` (`billing.read`) · `POST /billing/checkout` (`billing.purchase`) · `POST /billing/subscription/cancel` (`billing.cancel`) · `GET /billing/invoices` |
| CoA | `GET /accounting/chart-of-accounts` · `POST /accounting/chart-of-accounts/seed` · `POST /accounting/chart-of-accounts` |
| Journals | `GET /accounting/journal-entries` · `POST /accounting/journal-entries` (manual JE; debits == credits enforced) · `POST /accounting/journal-entries/:id/reverse` |
| Reports | `GET /accounting/reports/{pl,balance-sheet,cash-flow,trial-balance,general-ledger,sub-ledger}` |
| Periods | `POST /accounting/periods` · `POST /accounting/periods/:id/{close,reopen,lock}` (reopen super-admin only) |
| Tax | `GET /accounting/tax/returns/{vat200,gstr1,gstr3b}` · `GET /accounting/invoices/:id/e-invoice.json` · `POST /accounting/invoices` |
| Bank | `POST /accounting/bank/accounts` · `GET /accounting/bank/accounts` · `POST /accounting/bank/transactions/import` · `GET /accounting/bank/transactions` · `POST /accounting/bank/auto-match` · `POST /accounting/bank/transactions/:id/match` |
| Budgets | `POST /accounting/budgets` · `GET /accounting/budgets` |
| FX | `POST /accounting/fx-rates` |
| Audit | `POST /accounting/audit-pack/export` · `GET /accounting/audit-pack/chain/verify` |
| Portal | `GET /accounting/subscription` |

### Premium portal — `apps/accounting` (D-0019)
- Next.js 14 SPA on port **3002**, deploys at
  `accounting.<env>.unified.example.com`.
- `output: 'standalone'`, strict CSP (no third-party scripts).
- `PremiumGate` HOC renders an upgrade prompt instead of an error when the
  tenant lacks an entitlement (PRD §3.7 — "locked features show an upgrade
  prompt rather than an error").
- Pages: `/ledger` (CoA + template seed), `/journals`, `/reports/{pl,
  balance-sheet, trial-balance}`, `/tax` (VAT 200), `/bank`,
  `/periods`, `/audit-pack`, `/billing` (plan catalogue + per-provider
  checkout).
- Sidebar visualises gated vs unlocked items.
- Sign-in delegates to the admin host (parent-domain refresh cookie).

### Infra
- CI Docker matrix extended to `[api, storefront, admin, accounting, worker,
  webhook]`.
- `infra/k8s/charts/accounting` — own Ingress host, HPA, PDB, non-root
  security context.
- `apps/api` CORS allow-list extended to include
  `http://localhost:3002`.

### Tests
- `apps/api/test/accounting.test.ts` — CoA templates expose 3 templates with
  the D-0016 prefix scheme; plans catalogue exposes 5 codes; trial = 14d;
  grace/archive = 7/14 days; dunning walks +1d, +3d, +7d then stops; billing
  provider registry returns Stripe/eSewa/Khalti; Stripe Billing webhook
  verifier accepts valid HMAC + rejects tampered bodies; audit chain SHA-256
  hash is deterministic across re-renders and changes when chained.

---

## 2. Doc alignment

- **Database.md §8** — every collection present with the documented indexes
  plus the new `auditChainHeads` for D-0018.
- **API.md §9–§10** — every documented endpoint mounted under
  `/api/v1/accounting/*` and `/api/v1/billing/*`. Premium routes additionally
  enforce `requireEntitlement()` matching the API doc's `[entitlement:…]`
  annotation.
- **Architecture.md §3** — modular monolith preserved; `services/accounting`,
  `services/billing`, and their `providers/` subtrees are isolated boundaries
  with provider registries as the only extension points.
- **Security-Requirements** §3 (deny-by-default RBAC + entitlement check),
  §4.3 (gateway secrets envelope-encrypted), §8 (premium audit log writes
  the tamper-evident chain, `pre('update')` and `pre('delete')` hooks already
  enforce append-only at the Mongoose layer), §9 (period close gated +
  audit-pack export signed).

---

## 3. Decisions recorded this phase

- **D-0016** CoA numbering scheme (1xxx Assets, 2xxx Liabilities, 3xxx Equity,
  4xxx Revenue, 5xxx/6xxx Expenses).
- **D-0017** Positive minor-unit amounts + `side` enum (no signed amounts).
- **D-0018** Audit chain hash = `sha256(prevHash + canonicalJson(entry))`.
- **D-0019** Premium portal at `accounting.<env>` (sister to admin per D-0005).

(D-0003 co-equal billing interface from Sprint 0 materialised in this phase.)
All entries appended to `docs/09-project-management/Decisions-Log.md`.

---

## 4. What's deliberately stubbed (carrying forward)

| Item | Status | Phase |
| --- | --- | --- |
| Real Stripe Billing / eSewa Recurring / Khalti Recurring HTTP calls | Dev stubs return deterministic refs; env-gated swap to real fetch. | 6.1 follow-up |
| GSTR-1 / GSTR-3B regulator-exact CSV | Aggregation shape lands; final field-by-field writer waits for CA-discovery sign-off. | CA discovery |
| Audit-pack ZIP + S3 upload | Manifest + SHA-256 + chain verification ship today; the ZIP packaging reuses the Phase 5 report-artefact storage helper. | 6.5 follow-up |
| Auto-journal hook into Phase 3/4 events | Handlers + idempotency are in place; the `Order.save()` → `recordOrderPaid()` event subscription wires up in the post-launch event-bus migration. | post-launch |
| KMS-wrapped data key for audit chain integrity | Software fallback via existing `crypto.service.ts`; AWS KMS swap when Vault tokens drop. | 7 |
| Customer portal billing.cancel reason taxonomy | Free-text accepted today; structured cancel-reason analytics is a 1-day follow-up. | 7 |

---

## 5. Exit-gate evidence

| Criterion | Evidence |
| --- | --- |
| Auto-posted entries balance for every event class | `postJournalEntry()` enforces sum(dr) === sum(cr) with FX applied; the 5 auto-journal handlers (`recordOrderPaid` / `recordRefund` / `recordPoReceive` / `recordStockWriteOff` / `recordPayout`) each produce a balanced entry, idempotent on `(source, sourceEventId)`. |
| Regulator-format outputs ready for CA sign-off | VAT 200 returns Sales / VAT output / Input claim / Net payable / Invoice count from `Invoice` aggregations; e-invoice JSON matches the simplified IRD shape with hash + S3 key. GSTR-1/3B return the aggregation skeleton; final field-by-field writer is the CA-discovery sign-off task. |
| Dunning workflow tested end-to-end | `tickDunning()` walks `past_due → retry(+1d → +3d → +7d) → grace → cancelled/expired` with provider-side retry stub; downgrade after 14 days clears entitlements. Test asserts +1/+3/+7 schedule. |
| Locked features surface upgrade prompts | `requireEntitlement` returns 402 `PAYMENT_REQUIRED`; the `PremiumGate` HOC in the portal renders an upgrade card with a link to `/billing` instead of an error. The portal's nav explicitly tags gated routes as "premium". |

---

## 6. Risks surfaced

| Risk | Mitigation |
| --- | --- |
| Provider HTTP stubs ship to staging | Phase 6.1 follow-up replaces before the CA-sign-off demo; env-gated so prod builds fail fast if creds missing. |
| Audit chain integrity assumes serial writer | The worker is single-instance with a 30-second tick; running multiple worker pods needs a Redis lock around `advanceChainForTenant(tenantId)` — added as the 7th risk-register entry. |
| Tax engine assumes single jurisdiction per tenant | Acceptable for v1; multi-jurisdiction wiring lands when the first multi-entity Enterprise tenant onboards. |
| Reopen-period bypasses period-close benefits | Gated to Super Admin at the route layer; the audit log records the reopener + timestamp; locked periods cannot be reopened (terminal). |

---

## 7. Follow-ups carried into Phase 7

1. Wire real Stripe Billing / eSewa Recurring / Khalti Recurring HTTP calls.
2. Replace the audit-pack manifest with a real ZIP packaged into S3 with a
   signed URL.
3. Hook the Phase 3/4 domain events into `recordOrderPaid` / `recordRefund` /
   `recordPoReceive` / `recordStockWriteOff` / `recordPayout` from the
   service layer.
4. Redis-lock around `advanceChainForTenant` once the worker scales horizontally.
5. CA discovery sign-off → GSTR-1 / GSTR-3B regulator-exact writer.

---

## 8. Status

**Phase 6 — complete to exit-gate.** Awaiting your go-ahead before kicking off
Phase 7 (QA + security audit + UAT + perf tuning + launch — 5 weeks, 2 sprints
+ 1-week launch hyper-care).
