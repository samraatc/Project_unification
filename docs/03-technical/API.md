# API Documentation

**Project:** Unified Marketing & E-Commerce Management Platform
**Server:** Node.js 20 + Express 4
**Spec:** OpenAPI 3.1 (auto-generated to `apps/api/openapi.json`)
**Version:** 1.0

---

## 1. Conventions

All endpoints live under `/api/v1`. Request and response bodies are JSON with `Content-Type: application/json`. Authentication is `Authorization: Bearer <jwt>` unless explicitly marked public. RBAC and entitlement guards are documented per endpoint as `[role:permission]` and `[entitlement:feature_code]`.

Errors follow a uniform envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable summary.",
    "details": [{ "field": "email", "issue": "must be a valid email" }],
    "requestId": "01HXX..."
  }
}
```

Standard HTTP status codes: `200` success, `201` created, `204` no content, `400` validation, `401` unauthenticated, `403` forbidden (auth ok, RBAC/entitlement denied), `404` not found, `409` conflict, `422` unprocessable, `429` rate-limited, `500` server, `503` upstream.

Pagination: cursor-based by default (`?cursor=<opaque>&limit=20`), with `meta.nextCursor` in the response. List endpoints accept `?filter[field]=value`, `?sort=field,-otherField`.

Idempotency: write endpoints accept `Idempotency-Key` header; repeating the same key within 24h returns the original response.

Rate limits: 60 requests/min/IP on auth endpoints; 600 requests/min/token on authenticated endpoints; 5 requests/sec/token on payment endpoints. Limits surface via `RateLimit-*` headers.

## 2. Authentication & Identity

### 2.1 Register

`POST /api/v1/auth/register` *(public)*

```json
{ "email": "a@b.com", "password": "******", "firstName": "Asha", "lastName": "Bahadur" }
```

Issues a verification OTP via email/SMS. Returns `201` with `{ userId, verifyChannel }`.

### 2.2 Verify

`POST /api/v1/auth/verify` *(public)* — body `{ userId, code }`. Activates the user.

### 2.3 Login

`POST /api/v1/auth/login` *(public)* — body `{ identifier, password }`. Returns `{ accessToken, refreshToken, expiresIn }` and sets HttpOnly refresh cookie.

### 2.4 Refresh

`POST /api/v1/auth/refresh` *(public, cookie)*. Rotates refresh token; revokes the previous one. Returns new access token.

### 2.5 Logout

`POST /api/v1/auth/logout` *(authed)*. Revokes the refresh-token family.

### 2.6 OAuth

`GET /api/v1/auth/oauth/{provider}` *(public)* — initiates PKCE flow for `google` or `facebook`.
`GET /api/v1/auth/oauth/{provider}/callback` — completes the flow, issues tokens.

### 2.7 2FA

`POST /api/v1/auth/2fa/setup` *(authed)* — returns provisioning URL + backup codes.
`POST /api/v1/auth/2fa/verify` *(authed)* — `{ code }` activates.
`POST /api/v1/auth/2fa/disable` *(authed, 2fa)*.

### 2.8 Password

`POST /api/v1/auth/password/forgot` *(public)* — `{ identifier }`.
`POST /api/v1/auth/password/reset` *(public)* — `{ token, newPassword }`.
`POST /api/v1/auth/password/change` *(authed)* — `{ currentPassword, newPassword }`.

## 3. Users & RBAC

### 3.1 Users

- `GET /api/v1/users` `[admin:users.read]` — list users.
- `GET /api/v1/users/:id` `[admin:users.read]`.
- `POST /api/v1/users` `[admin:users.create]` — invite user.
- `PATCH /api/v1/users/:id` `[admin:users.update]`.
- `DELETE /api/v1/users/:id` `[admin:users.delete]` — soft delete; anonymises PII.
- `POST /api/v1/users/:id/roles` `[admin:roles.assign]` — body `{ roleIds: [...] }`.

### 3.2 Roles & Permissions

- `GET /api/v1/roles` `[admin:roles.read]`.
- `POST /api/v1/roles` `[admin:roles.create]` — `{ code, name, permissions: [...] }`.
- `PATCH /api/v1/roles/:id` `[admin:roles.update]`.
- `DELETE /api/v1/roles/:id` `[admin:roles.delete]`.
- `GET /api/v1/permissions` `[admin:roles.read]` — list available permission codes.

### 3.3 Me

- `GET /api/v1/me` — current user profile.
- `PATCH /api/v1/me` — update profile.
- `GET /api/v1/me/permissions` — expanded permission set + entitlements (used by the SPA to render conditionally).

## 4. Catalogue & Search

### 4.1 Products

- `GET /api/v1/products` *(public)* — list, with filter, sort, pagination.
- `GET /api/v1/products/:slug` *(public)* — PDP payload.
- `POST /api/v1/products` `[admin:products.create]`.
- `PATCH /api/v1/products/:id` `[admin:products.update]`.
- `DELETE /api/v1/products/:id` `[admin:products.delete]`.
- `POST /api/v1/products/import` `[admin:products.create]` — multipart CSV upload; returns import job ID.
- `GET /api/v1/imports/:jobId` `[admin:products.create]` — progress.

### 4.2 Categories & Brands

- `GET /api/v1/categories` *(public)* — full tree.
- `POST /api/v1/categories` `[admin:catalogue.update]`.
- `GET /api/v1/brands` *(public)*.

### 4.3 Search

- `GET /api/v1/search?q=&filter[category]=&filter[price]=&sort=&cursor=&limit=` *(public)*.
- `GET /api/v1/search/suggest?q=` *(public)* — under 100ms p95; returns top 8 suggestions.

### 4.4 Reviews

- `GET /api/v1/products/:id/reviews` *(public)*.
- `POST /api/v1/products/:id/reviews` *(authed)* — verified buyers only.
- `POST /api/v1/reviews/:id/helpful` *(authed)*.

## 5. Cart & Checkout

- `GET /api/v1/cart` — current cart (user or guest via session cookie).
- `POST /api/v1/cart/items` — `{ productId, variantId, qty }`. Atomic stock check.
- `PATCH /api/v1/cart/items/:itemId` — `{ qty }`.
- `DELETE /api/v1/cart/items/:itemId`.
- `POST /api/v1/cart/coupon` — `{ code }`.
- `DELETE /api/v1/cart/coupon`.
- `POST /api/v1/checkout/session` — start session. Returns `{ sessionId, step:'address' }`.
- `PATCH /api/v1/checkout/session/:id/address` — `{ addressId }` or new address.
- `PATCH /api/v1/checkout/session/:id/delivery` — `{ method }`.
- `POST /api/v1/checkout/session/:id/payment` — `{ method:'esewa|khalti|stripe|paypal|cod' }`. Returns gateway-specific payload (Stripe `clientSecret`, eSewa signed redirect URL, Khalti `productIdentity`).
- `POST /api/v1/checkout/session/:id/confirm` — body `{ gatewayRef }`. Finalises after gateway success.

## 6. Orders

- `GET /api/v1/orders` `[role:viewer+]` — list scoped to caller (customer sees own; admin sees all).
- `GET /api/v1/orders/:number`.
- `POST /api/v1/orders/:id/cancel` — customer cancel allowed until `processing`.
- `POST /api/v1/orders/:id/transitions` `[admin:orders.update]` — `{ to:'shipped', courierId, trackingNumber }`.
- `POST /api/v1/orders/:id/notes` `[admin:orders.update]`.
- `POST /api/v1/orders/:id/returns` *(customer)* — `{ items:[{itemId, qty, reason}], photos:[url] }`.
- `POST /api/v1/orders/:id/refunds` `[admin:orders.refund]`.
- `GET /api/v1/orders/track?orderNumber=&identifier=` *(public)* — guest tracking page.

## 7. Inventory

- `GET /api/v1/inventory` `[admin:inventory.read]`.
- `POST /api/v1/inventory/adjust` `[admin:inventory.adjust]` — `{ sku, delta, reason }`.
- `GET /api/v1/stock-movements` `[admin:inventory.read]`.
- `GET /api/v1/purchase-orders` `[admin:purchasing.read]`.
- `POST /api/v1/purchase-orders` `[admin:purchasing.create]`.
- `POST /api/v1/purchase-orders/:id/receive` `[admin:purchasing.update]` — `{ items:[{sku, qty}] }`.

## 8. Social Media

- `GET /api/v1/social/accounts` `[admin:social.read]`.
- `POST /api/v1/social/accounts/connect` `[admin:social.connect]` — initiates OAuth.
- `DELETE /api/v1/social/accounts/:id` `[admin:social.connect]`.
- `GET /api/v1/social/posts` `[editor:social.read]`.
- `POST /api/v1/social/posts` `[editor:social.draft]` — body includes per-platform overrides.
- `POST /api/v1/social/posts/:id/schedule` `[editor:social.schedule]` — `{ scheduledAt }`.
- `POST /api/v1/social/posts/:id/publish` `[admin:social.publish]`.
- `GET /api/v1/social/inbox` `[editor:inbox.read]` — filter by status, channel, assignee.
- `POST /api/v1/social/inbox/:id/reply` `[editor:inbox.reply]`.
- `POST /api/v1/social/inbox/:id/assign` `[admin:inbox.assign]`.
- `GET /api/v1/social/analytics?platform=&from=&to=` `[viewer:social.analytics]`.

## 9. Premium Accounting (entitlement-gated)

All endpoints require `[accountant:accounting.*]` plus `[entitlement:accounting.<feature>]`.

- `GET /api/v1/accounting/chart-of-accounts`.
- `POST /api/v1/accounting/chart-of-accounts`.
- `GET /api/v1/accounting/journal-entries?from=&to=`.
- `POST /api/v1/accounting/journal-entries` — manual entry; debits must equal credits.
- `POST /api/v1/accounting/journal-entries/:id/reverse`.
- `GET /api/v1/accounting/reports/pl?period=`.
- `GET /api/v1/accounting/reports/balance-sheet?asOf=`.
- `GET /api/v1/accounting/reports/cash-flow?period=&method=`.
- `GET /api/v1/accounting/reports/trial-balance?asOf=`.
- `GET /api/v1/accounting/reports/general-ledger?account=&from=&to=`.
- `POST /api/v1/accounting/periods/:id/close` `[entitlement:accounting.period_close]`.
- `GET /api/v1/accounting/tax/returns/vat200?period=`.
- `GET /api/v1/accounting/tax/returns/gstr1?period=`.
- `GET /api/v1/accounting/tax/returns/gstr3b?period=`.
- `GET /api/v1/accounting/invoices/:id/e-invoice.json` — Nepal IRD format.
- `GET /api/v1/accounting/bank/transactions?accountId=&status=unmatched`.
- `POST /api/v1/accounting/bank/transactions/:id/match` — `{ journalEntryId }` or auto-match.
- `POST /api/v1/accounting/audit-pack/export?period=` — returns a signed ZIP URL.
- `GET /api/v1/accounting/audit-log` `[entitlement:accounting.audit]`.

## 10. Subscription & Billing

- `GET /api/v1/billing/plans` *(public)*.
- `GET /api/v1/billing/subscription` `[admin:billing.read]`.
- `POST /api/v1/billing/checkout` `[admin:billing.purchase]` — `{ plan, cycle, paymentMethod }`. Returns gateway init payload.
- `POST /api/v1/billing/subscription/cancel` `[admin:billing.cancel]` — `{ reason }`.
- `GET /api/v1/billing/invoices` `[accountant:billing.read]`.
- `GET /api/v1/billing/invoices/:id.pdf` `[accountant:billing.read]`.

## 11. Real-Time (Socket.IO)

Namespace `/realtime`. Client connects with the JWT in the `auth` payload. The server places the socket in rooms based on the user's tenant and permissions.

Events emitted by the server:

- `order:created`, `order:status_changed`, `order:cancelled`, `order:refunded`.
- `inventory:low_stock`, `inventory:out_of_stock`, `inventory:back_in_stock`.
- `inbox:new_message`, `inbox:assigned`, `inbox:status_changed`.
- `notification:new`.
- `subscription:status_changed`.

Events accepted from the client:

- `inbox:typing` — coalesced broadcast to thread participants.
- `subscribe`, `unsubscribe` — opt into channels the user is permitted to see.

## 12. Webhooks (inbound)

Endpoints hosted under `/webhooks` on the dedicated webhook service. Each provider has a signature scheme; verification is the first step and any failure returns `401` immediately. Verified events are persisted to `paymentEvents` (or the provider-specific collection) and a BullMQ job is enqueued; the endpoint responds `200` before processing.

- `POST /webhooks/stripe` — Stripe signature header.
- `POST /webhooks/esewa` — eSewa HMAC.
- `POST /webhooks/khalti` — Khalti signature.
- `POST /webhooks/paypal` — PayPal verification call.
- `POST /webhooks/pathao` — Pathao bearer + secret.
- `POST /webhooks/aramex` — Aramex shared secret.
- `POST /webhooks/meta` — Meta App Secret signature.
- `POST /webhooks/tiktok` — TikTok signature.

## 13. Outbound Webhooks (developer API)

Enterprise tenants can register outbound webhooks to receive platform events.

- `GET /api/v1/webhooks` `[admin:webhooks.read]`.
- `POST /api/v1/webhooks` `[admin:webhooks.create]` — `{ url, events:[], secret }`.
- `POST /api/v1/webhooks/:id/rotate-secret` `[admin:webhooks.update]`.
- `GET /api/v1/webhooks/:id/deliveries` — recent attempts with status.

Deliveries are signed with `X-Signature: sha256=...` and include `X-Idempotency-Key`. Receivers should respond `2xx` within 5s; failures retry with exponential backoff up to 24h.

## 14. Versioning & Deprecation

The API is versioned by URL prefix (`/api/v1`). Breaking changes require a new prefix. Non-breaking additions ship inside the same version. Deprecations are announced 90 days in advance via the `Deprecation` and `Sunset` response headers and a changelog entry.

## 15. OpenAPI & SDKs

The OpenAPI 3.1 spec is auto-generated from the source and published to `apps/api/openapi.json` and at `GET /api/v1/openapi.json`. The TypeScript SDK is generated from the spec on every release and published as `@elskov/platform-sdk`. Postman collection generated and committed alongside.
