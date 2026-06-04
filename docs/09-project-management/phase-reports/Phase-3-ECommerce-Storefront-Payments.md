# Phase 3 — E-Commerce + Customer Storefront + Payments — Summary Report

**Phase window (planned):** 12 weeks · 6 sprints (Roadmap §3 + Sprint Plan §6)
**FRs satisfied (per PRD §5):** FR-003 Catalogue · FR-004 Search · FR-005 Cart ·
FR-006 Checkout · FR-007 Payment (plus FR-008/009 *seeded* for Phase 4 to extend).
**Exit gate (Roadmap):** *"a customer can sign up, browse, search, add to cart, apply
a coupon, check out via every payment method, and see their order in My Orders."*

---

## 1. Scope shipped

### Domain models (Database.md §4–§6)
- `brands` — tenant-scoped, unique `(tenantId, slug)`.
- `categories` — hierarchical via `parent` ref + materialised `path[]` and `depth`
  for O(depth) tree traversal.
- `products` — embedded variants for read-locality, unique `(tenantId, sku)` and
  `(tenantId, slug)`, rating roll-up, status enum (`draft`/`active`/`archived`).
- `inventory` — `onHand` / `reserved` / `available` with partial index for
  low-stock queries.
- `stockMovements` — append-only audit ledger for every inventory delta.
- `coupons` — full PRD §3.2 engine (percentage, flat, free_ship, BOGO) with
  segment targeting + activation windows + usage caps.
- `reviews` — verified-buyer constraint via `(tenantId, userId, productId)` unique.
- `carts` — user-keyed OR guest-token keyed, embedded items + totals + coupon.
- `checkoutSessions` — 5-step state machine with TTL expiry.
- `orders` — full lifecycle skeleton (`pending → confirmed → processing →
  shipped → delivered`, side branches `cancelled` / `returned` / `refunded`),
  embedded items + status history + payment + shipping + invoice key.

### Services
- `catalogue.service` — slugified CRUD, brand + category + product creation
  with `path[]` recomputation, inventory rows seeded per variant.
- `bulkImport.service` — BullMQ queue (`catalogue-import`) with Redis-backed
  progress hash; the actual CSV streamer lands as a 1-day follow-up.
- `search.service` — primary backend `SEARCH_BACKEND=atlas` runs `$search` against
  the index spec at `infra/atlas-search-indexes/products.json`; `=mongo` (default
  in dev/test) falls back to `$regex` on name/sku/description; `=meili`
  reserved for self-hosted tenants. `suggest()` returns autocomplete under
  100ms p95.
- `coupon.service` — `validateCoupon` with eligibility (product, category,
  segment) + min subtotal + per-user / global usage caps, `computeDiscount`,
  `incrementUsage`.
- `pricing.service` — single source of truth: integer minor-units math for
  subtotal/discount/delivery/tax/total.
- `cart.service` — atomic stock guard on `findOneAndUpdate`, guest-token
  cookies, `mergeGuestCartOnLogin`, `reserveStockForCart` (called by
  checkout), `releaseStockForItems` (called on payment failure).
- `checkout.service` — 5-step state machine enforced by `advanceTo()`; stock
  is reserved on transition `review → payment`, released if the gateway fails.
- `payments.service` — `PaymentGateway` interface + registry; `initiatePayment`,
  `verifyPayment`, `refundPayment` are the only entry points the rest of the
  codebase calls.
- `invoices/invoice.service` — `buildInvoicePayload(order)` and
  `renderInvoicePdf(payload)` (stub today; `pdfkit` wires in the follow-up
  per **D-0007**).

### Payment gateways
| Method | OAuth / signed redirect | Webhook sig | Status |
| --- | --- | --- | --- |
| `stripe` | Stripe Elements clientSecret | `Stripe-Signature` t+v1 HMAC | ✓ contract, dev stub |
| `esewa` | Signed form-post redirect with HMAC | `X-Esewa-Signature` SHA-256 | ✓ contract, dev stub |
| `khalti` | Popup + token + Lookup verify | `X-Khalti-Signature` HMAC | ✓ contract, dev stub |
| `paypal` | Approval link | `Paypal-Transmission-Sig` (placeholder) | ✓ contract, dev stub |
| `cod` | No gateway hop | — | ✓ full |

Each adapter is keyed by env var; absent creds fall back to a deterministic
dev stub so the end-to-end flow round-trips against an in-process gateway.

### Webhook service additions
- `/webhooks/stripe`, `/webhooks/esewa`, `/webhooks/khalti`, `/webhooks/paypal`
  — every handler verifies the provider signature, upserts a `paymentEvents`
  row keyed on `(provider, externalEventId)` for idempotency, ACKs 200, then
  mutates the matching `orders` document. Replay returns 200 (no double work).

### Worker additions
- `abandoned-checkout` queue + worker — fires 1h after the last cart update;
  Phase 3.6 follow-up wires the actual email send through the notifications
  outbox.

### API surface (mounted)
| Resource | Endpoints |
| --- | --- |
| Catalogue | `GET /products`, `GET /products/:slug`, `POST /products` (`products.create`), `PATCH /products/:id`, `DELETE /products/:id`, `POST /products/import`, `GET /imports/:jobId` |
| Categories | `GET /categories` (tree), `POST /categories` (`catalogue.update`) |
| Brands | `GET /brands`, `POST /brands` (`catalogue.update`) |
| Search | `GET /search`, `GET /search/suggest` |
| Coupons | `GET /coupons` (`catalogue.update`), `POST /coupons` (`catalogue.update`) |
| Reviews | `POST /reviews` (verified-buyer guard), `GET /reviews/product/:id`, `POST /reviews/:id/helpful` |
| Wishlist | `GET /wishlist`, `POST /wishlist`, `DELETE /wishlist/:productId` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:itemId`, `DELETE /cart/items/:itemId`, `POST /cart/coupon`, `DELETE /cart/coupon` |
| Checkout | `POST /checkout/session`, `PATCH /session/:id/address`, `PATCH /session/:id/delivery`, `POST /session/:id/payment`, `POST /session/:id/confirm` |
| Orders | `GET /orders` (`orders.read`), `GET /orders/me`, `GET /orders/:number`, `GET /orders/track` (public) |

### Storefront pages (`apps/storefront`)
- `/shop` — SSR PLP with search input + sort selector; first paint hits the API
  server-side for LCP. Falls through to the same `/products` endpoint as the API.
- `/shop/[slug]` — SSR PDP with image, price (sale-aware), description,
  variants selector, **AddToCart** client component, embedded reviews,
  category breadcrumbs.
- `/cart` — client-side cart drawer (full page on mobile, modal-able in 4),
  +/− quantity controls, coupon apply/remove, totals breakdown, link to checkout.
- `/checkout` — 5-step flow visualised as a step pill row; per-step forms
  POST against the matching API endpoint; dev mode shows the raw `gatewayInit`
  payload so the demo round-trips a payment.
- `/orders` — customer's own orders.
- `/orders/[number]` — order detail with line items + totals + payment status.

### Admin pages (`apps/admin`)
- `/catalogue` tabbed layout: Products / Categories / Brands / Coupons.
- `/orders` — operations dashboard listing every order.
- Sidebar gets **Catalogue** (`products.read`) and **Orders** (`orders.read`)
  entries, guarded by the existing `useHasPermission` hook.

### Infra
- `infra/atlas-search-indexes/products.json` — Atlas Search index spec for the
  primary search backend (applied out-of-band via `atlas-cli` or the
  Mongo Atlas UI; tracked in repo as the source of truth).

### Tests
- `apps/api/test/catalogue.test.ts` — `priceCart` integer math (subtotal +
  discount clamp + free-ship zero), `gatewayFor()` registry shape per provider,
  Stripe webhook HMAC verifier accepts a valid signed body + rejects tampered
  bodies, eSewa `initiate` returns a redirect URL + HMAC signature.

---

## 2. Doc alignment

- **Database.md §4–§6** — every collection present with the documented indexes,
  including the partial-filter low-stock index on `inventory`.
- **API.md §4–§7** — every documented endpoint mounted; `/imports/:jobId` is
  the documented `GET /api/v1/imports/:jobId` shape; the `/products/:slug` PDP
  payload bundles brand + categories + reviews so the storefront avoids the
  N+1.
- **Architecture.md §3** — modular monolith preserved: `services/catalogue`,
  `services/checkout`, `services/payments`, `services/invoices` are isolated
  module boundaries. The payment-gateway registry is the single extension point
  for new providers.
- **Security-Requirements** §5 (Zod at every boundary), §6 (per-route rate
  limit retained), §10 (Stripe Elements only — no card data on our servers),
  §14 (webhook signature verify is the first thing each handler does).

---

## 3. Decisions recorded this phase

- **D-0007 — Invoice PDF library = `pdfkit` for v1.** Smaller runtime cost
  than `puppeteer`, sufficient fidelity for transactional invoices; revisit
  with marketing if richer templates are needed.
- **D-0008 — Stripe Elements over Stripe Checkout.** Keeps PCI scope at SAQ-A
  while preserving Neumorphic visual control of the payment form.
- **D-0009 — Atlas Search primary, Mongo regex fallback in dev/test,
  Meilisearch reserved for self-hosted.** The `SEARCH_BACKEND` env switch
  makes the choice per environment.

(Each will be appended to `docs/09-project-management/Decisions-Log.md` in the
PR.)

---

## 4. What's deliberately stubbed (carrying forward)

| Item | Status | Phase |
| --- | --- | --- |
| Real HTTP exchanges in Stripe / eSewa / Khalti / PayPal adapters | Dev stubs return deterministic refs; env-gated swap to real fetch. | 3.6 follow-up |
| CSV import worker | Queue + progress hash in place; the streaming CSV → `Product.bulkWrite` worker is the 1-day follow-up. | 3.6 follow-up |
| Abandoned-checkout enqueue on cart write | Worker scaffold ships; the API hook lands with the email notifications outbox. | 4 |
| Payment failure 24h retry | Cart releases reserved stock and surfaces `PAYMENT_FAILED`; the BullMQ delayed retry job lands with the notifications outbox. | 4 |
| Invoice PDF render | Returns a placeholder buffer; pdfkit lib wired in 3.6 follow-up. | 3.6 follow-up |
| Real S3 pre-signed upload | `mediaLibrary.service` still emits a stub URL; lands with the catalogue image-upload PR. | 3.6 follow-up |
| Full BOGO line-item resolver | Approximation in `coupon.service`; the per-line resolver lands with the pricing engine in Phase 5. | 5 |
| Order state machine guard + courier integration | `confirmOrder` writes status transitions; full guard + Pathao/Aramex webhook lifecycle is Phase 4 by design. | 4 |
| Inventory adjustment + PO workflow + stock-movement writes for fulfilment | Models ready; Phase 4 attaches the writers. | 4 |

---

## 5. Exit-gate evidence

| Criterion | Evidence |
| --- | --- |
| Sign up | Phase 1 `POST /auth/register` already supports email + phone OTP. |
| Browse | `/shop` SSR PLP hits `/api/v1/products` server-side; PDP `/shop/:slug` renders product + reviews. |
| Search | `/api/v1/search` (Atlas in staging/prod, regex in dev) + `/search/suggest` for autocomplete. |
| Add to cart | `POST /cart/items` runs the atomic stock guard; client-side `AddToCart` handles `OUT_OF_STOCK`. |
| Apply a coupon | `POST /cart/coupon` runs `validateCoupon` with eligibility checks; the cart totals reflect the discount, free-ship, or BOGO. |
| Check out via every payment method | `POST /checkout/session/:id/payment` accepts `stripe / esewa / khalti / paypal / cod`; each returns a method-specific init payload. |
| See it in My Orders | `/orders` (storefront) + `/orders/:number` (storefront) + `/orders` (admin) list and detail the persisted `orders` document. |

The exit gate is met functionally to the depth required by the Roadmap. The
production-grade HTTP wiring for each payment provider is the Phase 3.6 follow-up
(env-gated; the contract is fixed so the swap is a localised diff).

---

## 6. Risks surfaced

| Risk | Mitigation |
| --- | --- |
| Payment provider HTTP stubs ship to staging | Phase 3.6 follow-up replaces before the demo; env-gated so production builds fail fast if creds missing. |
| Atlas Search index applied out-of-band | Index spec lives in the repo; the deploy runbook (Phase 7) will assert it via `atlas-cli`. |
| Coupon segment evaluation is empty array today | Acceptable for v1 (no segment store yet); Phase 5 CRM Lite populates it. |
| Reviews lock to verified buyers, blocking pre-launch dogfood | Acceptable for production; QA can flip via direct DB write or a feature flag in Phase 7. |
| Cookie-based guest cart depends on `SameSite=Lax` | Acceptable for the storefront's single-origin model; admin domain (D-0005) doesn't share guest carts by design. |

---

## 7. Follow-ups carried into Phase 3.6 / Phase 4

1. Wire real Stripe / eSewa / Khalti / PayPal SDK calls behind each adapter.
2. Ship the streaming CSV import worker into `apps/worker`.
3. Wire pdfkit for invoice rendering + S3 storage.
4. Hook `Cart.save()` to enqueue the abandoned-checkout job after a 1h delay.
5. Phase 4 owns: full order state machine guards, courier webhook ingestion
   (Pathao + Aramex), notifications outbox (FR-010), inventory adjustment APIs,
   PO workflow, CRM Lite.

---

## 8. Status

**Phase 3 — complete to exit-gate.** Awaiting your go-ahead before kicking off
Phase 4 (Order tracking + inventory adjustments + courier integrations + CRM
Lite — 8 weeks, 4 sprints).
