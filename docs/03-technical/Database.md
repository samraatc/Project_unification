# Database Design — MongoDB

**Project:** Unified Marketing & E-Commerce Management Platform
**Database:** MongoDB 7 (Atlas) via Mongoose
**Version:** 1.0

---

## 1. Modelling Principles

The schema follows three principles. **Aggregate per access pattern** — documents are designed around how they will be read, not how they are reduced from third normal form. Orders embed line items; products embed variants; carts embed items. **Reference for shared and high-cardinality data** — users, addresses, products are referenced by ObjectId from documents that need them. **Index for every supported query** — every read path is profiled and indexed; no full-collection scans in production.

All collections include a `tenantId` field (even though v1 is single-tenant) so a multi-tenant deployment is a configuration change rather than a migration.

## 2. Collection Inventory

The schema groups into seven domains: Identity & Access, Catalogue & Inventory, Cart & Checkout, Orders & Fulfilment, Social Media, Premium Accounting, and Cross-Cutting.

## 3. Identity & Access

### 3.1 `users`

```js
{
  _id: ObjectId,
  tenantId: ObjectId,
  email: { type: String, lowercase: true, index: { unique: true, sparse: true } },
  phone: { type: String, index: { unique: true, sparse: true } },
  passwordHash: String,            // bcrypt cost 12
  status: { type: String, enum: ['active','pending','suspended','deleted'], default: 'pending' },
  twoFA: {
    enabled: { type: Boolean, default: false },
    secret: String,                 // KMS-encrypted
    backupCodes: [String]
  },
  profile: {
    firstName: String, lastName: String, avatarUrl: String,
    dob: Date, gender: String
  },
  addresses: [{                     // up to 5
    label: String, line1: String, line2: String,
    city: String, region: String, postalCode: String, country: String,
    isDefault: Boolean
  }],
  wallets: { eSewaId: String, khaltiId: String },
  preferences: {
    notifications: { email: Boolean, sms: Boolean, push: Boolean },
    locale: String, currency: String
  },
  oauth: [{
    provider: { type: String, enum: ['google','facebook'] },
    providerUserId: String,
    accessToken: String,            // KMS-encrypted
    refreshToken: String
  }],
  savedSearches: [{ q: String, filters: Object, createdAt: Date }],
  wishlist: [{ productId: ObjectId, variantId: ObjectId, addedAt: Date }],
  lastLoginAt: Date,
  createdAt: Date, updatedAt: Date
}
```

Indexes: `{ email: 1 }` unique sparse; `{ phone: 1 }` unique sparse; `{ tenantId: 1, status: 1 }`; `{ 'oauth.provider': 1, 'oauth.providerUserId': 1 }`.

### 3.2 `roles`

```js
{
  _id: ObjectId,
  tenantId: ObjectId,
  code: { type: String, index: true },         // 'super_admin','admin','editor','accountant','viewer','auditor', or custom
  name: String,
  description: String,
  isSystem: Boolean,                            // built-in role
  permissions: [String],                        // dot-notated permission codes
  createdBy: ObjectId,
  createdAt: Date, updatedAt: Date
}
```

Permission codes follow `{domain}.{action}` e.g. `orders.update`, `accounting.ledger.read`, `social.publish`.

### 3.3 `userRoles`

```js
{ _id, tenantId, userId, roleId, scope: Object, assignedBy, assignedAt }
```

Indexes: `{ tenantId: 1, userId: 1 }`.

### 3.4 `permissions` (master list, seeded)

```js
{ _id, code: String, domain: String, description: String, isPremium: Boolean }
```

### 3.5 `refreshTokens`

```js
{ _id, userId, family: String, token: String, expiresAt: Date, revokedAt: Date, ip: String, ua: String }
```

Indexes: `{ token: 1 }` unique; `{ family: 1 }` for family revocation; TTL on `expiresAt`.

## 4. Catalogue & Inventory

### 4.1 `products`

```js
{
  _id, tenantId,
  sku: { type: String, unique: true, index: true },
  name: String, slug: { type: String, unique: true, index: true },
  description: String, descriptionRich: String,
  brand: { type: ObjectId, ref: 'brands' },
  categories: [{ type: ObjectId, ref: 'categories' }],
  images: [{ url: String, alt: String, isPrimary: Boolean, order: Number }],
  basePrice: Number, salePrice: Number, currency: String,
  taxClass: String,                  // 'standard','reduced','zero','exempt'
  attributes: Object,                // arbitrary key/value
  variants: [{                       // embedded for read-locality
    _id: ObjectId, sku: String,
    options: Object,                 // e.g. { size:'M', colour:'Red' }
    price: Number, salePrice: Number,
    images: [{ url, alt }],
    barcode: String
  }],
  status: { type: String, enum: ['draft','active','archived'] },
  seo: { metaTitle: String, metaDescription: String, ogImage: String },
  rating: { avg: Number, count: Number },
  createdAt: Date, updatedAt: Date
}
```

Indexes: `{ slug: 1 }` unique; `{ tenantId: 1, status: 1, categories: 1 }`; Atlas Search index on `name`, `description`, `brand`, `categories.name`, `attributes`.

### 4.2 `categories`

```js
{ _id, tenantId, name, slug, parent: ObjectId, path: [ObjectId], image, order, status }
```

### 4.3 `brands`

```js
{ _id, tenantId, name, slug, logoUrl, description, status }
```

### 4.4 `inventory`

```js
{
  _id, tenantId,
  sku: { type: String, unique: true, index: true },
  productId: ObjectId, variantId: ObjectId,
  onHand: Number, reserved: Number, available: Number,   // available = onHand - reserved
  threshold: Number,                                      // low-stock alert
  warehouse: String,
  updatedAt: Date
}
```

Operations are atomic via `findOneAndUpdate` with `$inc` and a guard on `available >= qty`.

### 4.5 `stockMovements`

```js
{
  _id, tenantId, sku, type: { enum: ['order_reserve','order_fulfil','return_restock','adjustment','po_receive','write_off'] },
  qtyChange: Number, balanceAfter: Number,
  referenceType: String, referenceId: ObjectId,    // order, PO, manual
  userId: ObjectId, reason: String, createdAt: Date
}
```

Indexes: `{ tenantId: 1, sku: 1, createdAt: -1 }`.

### 4.6 `purchaseOrders`

```js
{
  _id, tenantId, number: String,
  supplier: { name, contact, address },
  status: { enum: ['draft','sent','partial','received','cancelled'] },
  items: [{ sku, qtyOrdered, qtyReceived, unitCost }],
  expectedAt: Date, receivedAt: Date,
  createdBy: ObjectId, createdAt: Date, updatedAt: Date
}
```

## 5. Cart & Checkout

### 5.1 `carts`

```js
{
  _id, tenantId,
  userId: ObjectId,                            // present when logged in
  guestToken: String,                          // present when guest
  items: [{ productId, variantId, sku, qty, unitPrice, snapshotName, snapshotImage }],
  coupon: { code, type, value, validatedAt },
  totals: { subtotal, discount, deliveryFee, tax, total },
  currency: String,
  updatedAt: Date
}
```

Indexes: `{ userId: 1 }`; `{ guestToken: 1 }`.

### 5.2 `checkoutSessions`

```js
{
  _id, tenantId, cartId, userId, guestToken,
  step: { enum: ['address','delivery','review','payment','confirmation'] },
  addressId, shippingMethod, paymentMethod, paymentRef,
  status: { enum: ['active','completed','expired'] },
  expiresAt: Date
}
```

TTL index on `expiresAt`.

## 6. Orders & Fulfilment

### 6.1 `orders`

```js
{
  _id, tenantId, number: { type: String, unique: true, index: true },
  userId: ObjectId, guestEmail: String,
  status: { enum: ['pending','confirmed','processing','shipped','delivered','returned','refunded','cancelled'], index: true },
  items: [{ productId, variantId, sku, name, qty, unitPrice, subtotal, taxRate, taxAmount }],
  totals: { subtotal, discount, deliveryFee, tax, total },
  payment: {
    method: { enum: ['esewa','khalti','stripe','paypal','cod'] },
    status: { enum: ['pending','paid','failed','refunded'] },
    gatewayRef: String, paidAt: Date
  },
  shipping: {
    address: Object,
    courier: String, trackingNumber: String,
    shippedAt: Date, deliveredAt: Date,
    scanEvents: [{ status, location, ts }]
  },
  notes: [{ author: ObjectId, body: String, internal: Boolean, ts: Date }],
  statusHistory: [{ from, to, changedBy: ObjectId, ts: Date, reason: String }],
  createdAt: Date, updatedAt: Date
}
```

Indexes: `{ tenantId: 1, status: 1, createdAt: -1 }`; `{ tenantId: 1, userId: 1, createdAt: -1 }`; `{ 'shipping.trackingNumber': 1 }`.

### 6.2 `returns`

```js
{ _id, tenantId, orderId, items: [{ orderItemId, qty, reason }], photos: [String], status, requestedAt, decidedAt, decidedBy }
```

### 6.3 `refunds`

```js
{ _id, tenantId, orderId, amount, currency, gateway, gatewayRef, status: { enum: ['pending','succeeded','failed'] }, processedAt }
```

### 6.4 `couriers`

```js
{ _id, tenantId, code, name, trackingUrlTemplate, webhookSecret, isActive }
```

## 7. Social Media

### 7.1 `socialAccounts`

```js
{
  _id, tenantId,
  platform: { enum: ['facebook','instagram','tiktok'] },
  externalAccountId: String, name: String, handle: String,
  oauth: { accessToken: String, refreshToken: String, expiresAt: Date }, // KMS-encrypted
  status: { enum: ['connected','disconnected','expired'] },
  connectedBy: ObjectId, connectedAt: Date
}
```

### 7.2 `posts`

```js
{
  _id, tenantId,
  content: String, mediaUrls: [String],
  targets: [{ socialAccountId: ObjectId, overrides: Object, externalPostId: String, status, publishedAt, error }],
  status: { enum: ['draft','pending_approval','scheduled','publishing','published','failed'] },
  scheduledAt: Date,
  createdBy: ObjectId, approvedBy: ObjectId, createdAt: Date
}
```

### 7.3 `inboxMessages`

```js
{
  _id, tenantId,
  socialAccountId, platform, threadId, externalMessageId,
  authorHandle, body, mediaUrls,
  direction: { enum: ['inbound','outbound'] },
  assignedTo: ObjectId, status: { enum: ['new','open','responded','closed'] },
  receivedAt: Date, respondedAt: Date, slaBreachedAt: Date
}
```

Indexes: `{ tenantId: 1, status: 1, receivedAt: -1 }`; `{ threadId: 1 }`.

### 7.4 `mediaAssets`

```js
{ _id, tenantId, key, mime, sizeBytes, tags: [String], usedIn: [{ entity, entityId }], uploadedBy, uploadedAt }
```

## 8. Premium Accounting

### 8.1 `subscriptions`

```js
{
  _id, tenantId,
  plan: { enum: ['trial','monthly','yearly','lifetime','enterprise'] },
  status: { enum: ['active','past_due','cancelled','expired','grace'] },
  cycle: { enum: ['none','monthly','yearly','one_off'] },
  startedAt: Date, expiresAt: Date, cancelledAt: Date,
  gateway: { provider, customerRef, subscriptionRef },
  entitlements: [String],                  // expanded feature codes
  seats: Number,
  history: [{ event, at, payload }]
}
```

### 8.2 `chartOfAccounts`

```js
{ _id, tenantId, code, name, type: { enum: ['asset','liability','equity','revenue','expense'] }, parent: ObjectId, isActive }
```

### 8.3 `journalEntries`

```js
{
  _id, tenantId, number, postedAt: Date, periodId: ObjectId,
  reference: String,                       // source event id or external ref
  source: { enum: ['order','refund','payout','stock_writeoff','po_receive','manual','recurring'] },
  description: String,
  lines: [{ accountId, debit, credit, currency, fxRate, memo }],
  createdBy: ObjectId, approvedBy: ObjectId, status: { enum: ['draft','posted','reversed'] },
  reversalOf: ObjectId
}
```

Constraint enforced in application: sum of debits equals sum of credits per entry.

### 8.4 `taxRates`

```js
{ _id, tenantId, code, name, ratePct, jurisdiction, validFrom: Date, validTo: Date }
```

### 8.5 `invoices`

```js
{ _id, tenantId, orderId, number, issuedAt, dueAt, taxTotal, total, currency, pdfKey, eInvoiceJson, status }
```

### 8.6 `periods`

```js
{ _id, tenantId, type: { enum: ['month','quarter','year'] }, startsAt, endsAt, status: { enum: ['open','closed','locked'] } }
```

### 8.7 `bankAccounts`

```js
{ _id, tenantId, name, ledgerAccountId, currency, balance, lastReconciledAt }
```

### 8.8 `bankTransactions`

```js
{ _id, tenantId, bankAccountId, date, amount, reference, matchedJournalId, status: { enum: ['unmatched','matched','ignored'] } }
```

### 8.9 `budgets`

```js
{ _id, tenantId, year, costCentre, accountId, monthly: [Number] }   // 12 entries
```

## 9. Cross-Cutting

### 9.1 `auditLog`

```js
{
  _id, tenantId, actorId, action, entity, entityId,
  beforeJson, afterJson,
  ip, ua, ts,
  premium: Boolean                          // true for accounting events; affects retention/storage class
}
```

Stored on an immutable Mongo cluster (or with WORM-style backup); never deleted.

### 9.2 `notificationOutbox`

```js
{
  _id, tenantId, channel: { enum: ['email','sms','push'] },
  template, payload, toUserId, status: { enum: ['pending','sending','sent','failed'] },
  attempts: Number, lastError: String, sentAt: Date
}
```

### 9.3 `paymentEvents`

```js
{ _id, provider, externalEventId: { type: String, unique: true }, type, payloadHash, payload, processedAt }
```

Unique index on `externalEventId` provides webhook idempotency.

### 9.4 `featureFlags`

```js
{ _id, key, description, enabled: Boolean, rolloutPct: Number, tenants: [ObjectId] }
```

### 9.5 `webhookEndpoints`

```js
{ _id, tenantId, url, events: [String], secret, status, lastDelivery: { at, status, error } }
```

## 10. Transactions

MongoDB 7 multi-document ACID transactions are used in the following flows where atomicity across collections is required:

- **Order creation:** create `orders` (Pending) + decrement `inventory.available` (atomic guard) + append `stockMovements` + create `checkoutSessions.paymentRef`. All-or-nothing.
- **Payment confirmation:** update `orders.status` → Confirmed + update `orders.payment.status` → paid + insert `journalEntries` (for Premium tenants) + insert `notificationOutbox` rows.
- **Refund:** insert `refunds` + insert reversing `journalEntries` + restock `inventory` + append `stockMovements`.
- **Subscription transition:** update `subscriptions.status` + invalidate `entitlements` cache (Redis) + insert `auditLog`.

## 11. Indexes — Summary

Beyond the collection-level indexes called out above, the following compound indexes back common queries:

- `orders`: `{ tenantId, status, createdAt: -1 }`, `{ tenantId, userId, createdAt: -1 }`, `{ tenantId, 'payment.status', createdAt: -1 }`.
- `products`: Atlas Search compound on `name`, `description`, `brand`, `categories`; `{ tenantId, status, categories }`; `{ slug }` unique.
- `inventory`: `{ tenantId, sku }` unique; `{ tenantId, available: 1 }` partial where `available <= threshold` for low-stock query.
- `journalLines`: `{ tenantId, periodId, accountId }`, `{ tenantId, postedAt: -1 }`.
- `auditLog`: `{ tenantId, entity, entityId, ts: -1 }`, `{ tenantId, actorId, ts: -1 }`.

## 12. Data Retention & Archiving

Operational data is retained indefinitely while the tenant is active. Soft-deleted user records (`status='deleted'`) anonymise PII fields immediately and are purged from operational replicas after 30 days; the audit log of their actions is retained per regulatory requirement (typically 7 years for accounting data, 3 years for marketing data). Premium accounting data is never auto-deleted; the audit log is immutable and not subject to retention purge. Inactive tenants are archived to cold storage after 90 days of inactivity with a documented restore path.

## 13. Migrations

Schema changes are applied via `migrate-mongo` migrations checked into the repo. Migrations are forward-only; data backfills run as BullMQ jobs to avoid blocking the API. Every migration includes a documented rollback plan even when irreversible.

## 14. Backup & Recovery

Atlas continuous backup with point-in-time recovery covering the last 7 days; snapshot retention 30 days. Cross-region snapshot replication for DR. Restore drill executed quarterly. See `05-devops/Backup-Recovery.md`.
