# Wireframes

This folder holds the wireframe set for the Unified Marketing & E-Commerce Management Platform. Wireframes are produced in Figma and exported to PNG/PDF in this folder for offline review. The Figma source-of-truth is linked below.

## Figma Source

- **Figma file:** `[link to be added once shared]`
- **Design lead:** UI/UX Designer (see `09-project-management/Sprint-Plan.md`)

## Wireframe Inventory

The wireframe set covers every screen the platform ships in v1, grouped by surface.

### Storefront (Customer-Facing)

- `storefront/01-home.png` — Hero with parallax + Spline 3D scene, category grid, featured/trending/flash-sale, recently-viewed
- `storefront/02-mega-menu.png` — Full-width category mega menu from sticky header
- `storefront/03-plp.png` — Product Listing Page; grid/list toggle, filter sidebar (NeuChips), sort, infinite scroll
- `storefront/04-pdp.png` — Product Detail Page; image gallery with zoom, variant picker, tabbed details, reviews, FBT
- `storefront/05-cart-drawer.png` — Slide-in cart drawer with coupon entry and live totals
- `storefront/06-checkout-stepper.png` — 5-step checkout (Address → Delivery → Review → Payment → Confirmation)
- `storefront/07-payment-screens.png` — eSewa redirect, Khalti popup, Stripe Elements card form, COD confirmation
- `storefront/08-order-confirmation.png` — Order placed, timeline preview, share invoice
- `storefront/09-my-orders.png` — Active and historical orders, reorder, invoice download
- `storefront/10-order-tracking.png` — Live tracking stepper, courier scan timeline, ETA, optional map
- `storefront/11-guest-track.png` — `/track` page with Order ID + Email/Phone entry
- `storefront/12-profile.png` — Profile, addresses, wallets, preferences, GDPR export & delete
- `storefront/13-wishlist.png` — Wishlist grid with move-to-cart
- `storefront/14-reviews.png` — Verified review form with photo upload; product reviews list
- `storefront/15-help-centre.png` — Searchable help, FAQ, contact ticket
- `storefront/16-auth.png` — Login, signup, OTP, OAuth screens
- `storefront/17-pricing.png` — Sticky-section pricing comparison driven by GSAP ScrollTrigger

### Admin Console

- `admin/01-login.png` — Admin login with 2FA TOTP
- `admin/02-dashboard.png` — KPI tiles, revenue chart, alerts
- `admin/03-sidebar-collapsed.png` — Collapsible sidebar in collapsed state with popover sub-menus
- `admin/04-sidebar-expanded.png` — Expanded sidebar showing nav hierarchy
- `admin/05-users.png` — Users table, invite, role assignment
- `admin/06-roles.png` — Role editor with permission grid
- `admin/07-social-composer.png` — Unified composer with per-platform overrides
- `admin/08-social-scheduler.png` — Calendar scheduler with best-time recommendations
- `admin/09-social-inbox.png` — Unified inbox with assign, SLA, reply
- `admin/10-social-analytics.png` — Engagement, reach, follower growth dashboards
- `admin/11-media-library.png` — S3-backed asset library with tags
- `admin/12-products.png` — Catalogue grid with bulk import
- `admin/13-product-editor.png` — Product CRUD with variant tree builder
- `admin/14-orders.png` — Orders dashboard with summary tiles + table
- `admin/15-order-detail.png` — Order detail panel with status history
- `admin/16-inventory.png` — Live stock, reserved/available split, low-stock alerts
- `admin/17-purchase-orders.png` — PO workflow Draft → Sent → Partially Received → Fully Received
- `admin/18-stock-movements.png` — Stock movement log filter/export
- `admin/19-couriers.png` — Courier registry + webhook config
- `admin/20-crm.png` — Customer profiles, segments, communication log
- `admin/21-coupons.png` — Coupon engine UI
- `admin/22-notifications.png` — Notification preferences (org-wide)

### Accounting Portal (Premium)

- `accounting/01-paywall.png` — Locked-feature upgrade prompt
- `accounting/02-coa.png` — Chart of Accounts editor
- `accounting/03-journals.png` — Journal entries grid + auto-posted highlight
- `accounting/04-manual-journal.png` — Manual journal entry dialog
- `accounting/05-tax-config.png` — Tax rates by product/category
- `accounting/06-tax-returns.png` — VAT 200, GSTR-1, GSTR-3B exports, IRD e-invoice JSON
- `accounting/07-pl.png` — P&L by period
- `accounting/08-balance-sheet.png` — Balance Sheet with comparative periods
- `accounting/09-cash-flow.png` — Cash-flow statement
- `accounting/10-trial-balance.png` — Trial balance, drill-down
- `accounting/11-bank-recon.png` — Bank reconciliation matcher
- `accounting/12-budget.png` — Budget setup + variance reports
- `accounting/13-audit-trail.png` — Immutable audit log viewer
- `accounting/14-audit-pack.png` — Audit pack export

### Subscription & Billing

- `billing/01-plans.png` — Plan comparison and CTA
- `billing/02-checkout.png` — Plan checkout (Stripe / eSewa / Khalti)
- `billing/03-manage.png` — Self-service plan, card, invoices, cancel
- `billing/04-dunning.png` — Failed-renewal dunning notice

## Conventions

Wireframes use the Neumorphic component library; all motion behaviour is annotated on the Figma frames with the Framer Motion variant name (`fadeUp`, `scaleIn`, etc.). Each frame links to the matching component in `02-design/Design-System.md`. PDPs and admin tables include an empty-state, loading-skeleton, and error-state variant.

## Review Process

Wireframes are reviewed in two passes per sprint. Pass 1 (mid-sprint): designer + PO + tech lead walk the new screens, capture changes inline in Figma. Pass 2 (end of sprint): full stakeholder review with engineering, QA, and PO sign-off before the frames are exported here and the corresponding stories are unblocked for implementation.

## Export Pipeline

A nightly script exports Figma frames to PNG at 2× and PDF at 1× into the matching subfolder. The script also publishes a JSON manifest (`wireframes.manifest.json`) listing every frame with its current revision hash so engineers can detect upstream changes.
