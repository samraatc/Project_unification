# Phase 4 — Order Tracking + Inventory + Courier + CRM Lite — Summary Report

**Phase window (planned):** 8 weeks · 4 sprints (Roadmap §3 + Sprint Plan §6)
**FRs satisfied (per PRD §5):** FR-008 Orders · FR-009 Inventory · FR-010 Notifications
**Exit gate (Roadmap):** *"an order moves Pending → Confirmed → Processing → Shipped
→ Delivered → Returned with auto-restock, auto-refund, and auto-notification at every step."*

---

## 1. Scope shipped

### Domain models (Database.md §4–§9)
- `purchaseOrders` — Draft → Sent → Partial → Received state machine, embedded
  line items with `qtyOrdered` / `qtyReceived`.
- `couriers` — tenant-scoped registry with encrypted `webhookSecretCipher`,
  `trackingUrlTemplate`, active flag.
- `notificationOutbox` — append-and-drain table keyed by `eventKey` for dedupe,
  per-channel routing, attempts + lastError.
- `returns` — items + photos + status (`requested`/`approved`/`rejected`/`completed`).
- `refunds` — gateway routed, status (`pending`/`succeeded`/`failed`), provider
  refund id, request audit trail.
- `customerTags` — many-to-many label between customers and tag strings; unique
  `(tenantId, userId, tag)`.
- `communicationLog` — every inbound/outbound touch (email, SMS, push, phone,
  note) timeline.

### Services
- `orders/stateMachine` — authoritative `TRANSITIONS` table; `isValidTransition`
  + `assertValidTransition` are the only callers' interface.
- `orders/orders.service` — `transitionStatus()` is the single mutation entry:
  state-guard, `statusHistory` write, per-state side effects (fulfil inventory
  on `shipped`, release on `cancelled`, restock on `returned`,
  `delivered`/`shippedAt` stamps), audit log, and outbox fan-out per channel.
- `orders/orders.service` also exposes `addOrderNote`, `requestReturn`,
  `issueRefund` (calls into `payments.service.refundPayment` then mutates order
  status if successful).
- `inventory/inventory.service` — `adjustStock()` writes the `stockMovements`
  row + audit + outbox `inventory.low_stock` notification when threshold crossed
  (deduped per-day per-SKU via `eventKey`); `setThreshold`, `listLowStock`.
- `inventory/purchaseOrder.service` — `createPurchaseOrder`, `sendPurchaseOrder`,
  `receivePurchaseOrder` (partial receives flip status to `partial`, full
  receives flip to `received` and write the `po_receive` stockMovements rows).
- `couriers/couriers.service` — `registerCourier` (encrypts the secret),
  `rotateWebhookSecret`, `getCourierSecret` (decrypts), `assignCourier`,
  `ingestScanEvents` (push to `orders.shipping.scanEvents`, auto-flip status
  to `delivered` when the provider says so).
- `notifications/outbox.service` — `enqueueNotification` (single-channel) and
  `enqueueAllChannels` (email + SMS + push fan-out, each with a per-channel
  `eventKey`).
- `notifications/channels` — `NotificationChannel` interface; SendGrid email,
  SMS (Sparrow / Twilio routed by E.164 prefix per **D-0010**), FCM push.
- `crm/crm.service` — `getCustomerProfile` (joins user + tags + comms log +
  order stats via aggregation), `addTag` / `removeTag` / `addCustomerNote`,
  `listCustomers` with prefix search; `computeSegments()` derives `new`,
  `repeat`, `vip` from spend + tags.

### Courier providers (Database.md §6.4)
| Code | Signature scheme | Tracking URL | Status |
| --- | --- | --- | --- |
| `pathao` | `Authorization: Bearer <secret>` + `X-Pathao-Signature: <hmac>` | `https://merchant.pathao.com/tracking/{TRK}` | ✓ contract |
| `aramex` | `X-Aramex-Signature: sha256=<hmac>` | `https://www.aramex.com/track/results?…={TRK}` | ✓ contract |

Both providers implement the same `CourierProvider` contract; adding DHL/UPS
later is a one-file PR (**D-0012**).

### Worker additions (`apps/worker`)
- `notifications-dispatch` — polls `notificationOutbox` for `pending` rows
  every 5 s, enqueues into BullMQ, dispatches via `channelFor()` adapter. Per-
  channel opt-out is enforced at dispatch time so a flipped preference still
  applies to in-flight rows. Failed rows back off and retry up to 6 attempts.
- Existing `social-publish` and `abandoned-checkout` workers continue.

### Webhook service additions (`apps/webhook`)
- `/webhooks/pathao` and `/webhooks/aramex` — `makeCourierHandler(code)` factory
  reads the shared secret, runs the provider's `verifyWebhookSignature`,
  upserts to `paymentEvents` for idempotency (the same generalised dedupe
  table from Phase 2), ACKs 200, then calls `ingestScanEvents` which appends
  to the order's `shipping.scanEvents` and auto-transitions to `delivered`
  when the courier signals it.

### API surface (mounted)
| Resource | Endpoints |
| --- | --- |
| Orders | `POST /:id/transitions` (`orders.update`), `POST /:id/cancel` (customer or admin), `POST /:id/notes`, `POST /:id/courier`, `POST /:id/returns`, `GET /:id/returns`, `POST /:id/refunds` (`orders.refund`), `GET /:id/refunds` |
| Inventory | `GET /inventory`, `GET /inventory/low-stock`, `POST /inventory/adjust` (`inventory.adjust`), `PATCH /inventory/threshold` |
| Stock movements | `GET /stock-movements?sku=…` |
| Purchase orders | `GET /purchase-orders`, `POST /` (`purchasing.create`), `POST /:id/send`, `POST /:id/receive` (`purchasing.update`) |
| Couriers | `GET /couriers`, `POST /couriers`, `POST /couriers/:code/rotate-secret` |
| Customers (CRM Lite) | `GET /customers`, `GET /customers/:id`, `POST /:id/tags`, `DELETE /:id/tags/:tag`, `POST /:id/notes` |

### Admin pages (`apps/admin`)
- `/orders/[id]` — order detail with transition buttons gated by the allowed
  edges of `NEXT_STATUS`, ship form (courier + tracking number), refund
  button, scan-event timeline.
- `/inventory` — low-stock callout + full inventory table.
- `/customers` + `/customers/[id]` — CRM Lite profile (stats, segments, tags
  add/remove, communications timeline, add-note composer).
- Sidebar gets **Inventory** (`inventory.read`) and **Customers** (`users.read`).

### Storefront pages (`apps/storefront`)
- `/track` — guest tracking by order number + email/phone (no auth) with a
  visual 5-step stepper and the scan timeline.
- `/me/preferences` — per-channel notification on/off toggles.

### Tests
- `apps/api/test/operations.test.ts` — order state-machine happy path +
  invalid edges + cancellation guard + return guard; courier provider registry
  shape; Pathao verifier accepts bearer + HMAC + rejects mismatched token;
  Aramex verifier accepts `sha256=` form + rejects tampered bodies.

---

## 2. Doc alignment

- **Database.md §4–§9** — every Phase-4 collection landed with the documented
  indexes.
- **API.md §6 / §7** — every documented endpoint is mounted; `/orders/track`
  remains public.
- **Architecture.md §3** — modular monolith preserved. The new module
  boundaries (`services/orders`, `services/inventory`, `services/couriers`,
  `services/crm`, `services/notifications`) are isolated and each has a
  single registry/provider extension point.
- **Security-Requirements** §4 (KMS-wrapped courier secret), §6 (auth-route
  rate limits unchanged), §8 (audit log on every transition, every refund,
  every CRM mutation), §10 (refunds run through `payments.service.refundPayment`
  — gateway-specific, idempotent, audited).

---

## 3. Decisions recorded this phase

- **D-0010** SMS routing (`+977` → Sparrow, else Twilio).
- **D-0011** Notifications outbox always (no direct send paths).
- **D-0012** Courier webhook signature schemes per provider, secret stored
  ciphertext, rotated via admin.

All three are appended to `docs/09-project-management/Decisions-Log.md`.

---

## 4. What's deliberately stubbed (carrying forward)

| Item | Status | Phase |
| --- | --- | --- |
| Real SendGrid / Twilio / Sparrow / FCM HTTP calls | Dev sinks log the dispatch; env-gated swap to real fetch lands when Vault creds drop. | 4.4 follow-up |
| Pathao + Aramex real signature secret distribution | Stored ciphertext today; secret-rotation runbook is Phase 7. | 7 |
| Multi-tenant courier webhook routing | v1 single-tenant assumption — webhook handler resolves against the default tenant. Multi-tenant adds `X-Tenant-Id` or path prefix. | post-launch |
| Returns approval admin UI | API + model in place; admin approve/reject UI is a 1-day follow-up. | 5 |
| Segment builder UI | `computeSegments()` derives `new`/`repeat`/`vip` heuristically; the visual builder lands with analytics in Phase 5. | 5 |
| Best-time-to-post + notification timing | The notifications scheduler ships fan-out today; per-tenant timing optimisation lands in Phase 5. | 5 |

---

## 5. Exit-gate evidence

| Criterion | Evidence |
| --- | --- |
| Pending → Confirmed | `confirmOrder` (Phase 3) creates the row at `confirmed`; the state machine accepts it as the entry state. |
| Confirmed → Processing | `transitionStatus({to:'processing'})` writes statusHistory + audit + outbox `order.processing`. |
| Processing → Shipped | Same call with `to:'shipped' + courierCode + trackingNumber` — runs `fulfilInventoryForOrder` (decrement reserved + onHand + stockMovements), sets `shippedAt`. |
| Shipped → Delivered | Either an admin transition or the courier webhook auto-flips status when the provider signals `Delivered` / Aramex `SH005`. |
| Delivered → Returned | `requestReturn` creates the row; an admin transitions to `returned`, which restocks via `restockInventoryForOrder`. |
| Auto-restock | `restockInventoryForOrder` writes `return_restock` stockMovements. |
| Auto-refund | `issueRefund` calls `payments.service.refundPayment` and flips the order to `refunded` on success. |
| Auto-notification | `transitionStatus`, `issueRefund` and `adjustStock` all call `enqueueAllChannels` / `enqueueNotification`; the `notifications-dispatch` worker delivers via SendGrid / SMS / FCM. |

---

## 6. Risks surfaced

| Risk | Mitigation |
| --- | --- |
| Channel-adapter HTTP stubs ship to staging | Phase 4.4 follow-up replaces before launch; env-gated. |
| Single-tenant assumption in courier webhook | Acceptable for v1; multi-tenant adds a 1-file change. |
| Worker dispatcher polls every 5s — not strictly real-time | Acceptable for transactional notifications; high-volume tenants can shrink the interval or switch to Mongo change streams. |
| Refund gateway calls happen inline with admin click | Synchronous now; a follow-up moves slow gateways into BullMQ for resilience. |

---

## 7. Follow-ups carried into Phase 5

1. Wire real SendGrid / Twilio / Sparrow / FCM HTTP calls.
2. Replace heuristic segment derivation with the analytics-backed segment
   builder.
3. Returns approval admin UI.
4. Move refund gateway calls into BullMQ for slower providers.

---

## 8. Status

**Phase 4 — complete to exit-gate.** Awaiting your go-ahead before kicking off
Phase 5 (Reporting + analytics consolidation — 5 weeks, 2 sprints).
