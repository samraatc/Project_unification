# Unified Marketing & E-Commerce Management Platform

A single, role-controlled web application that consolidates social media management
(Facebook + Instagram + TikTok), a multi-gateway e-commerce engine (eSewa, Khalti,
Stripe, PayPal, COD), order tracking + inventory + couriers (Pathao, Aramex), granular
RBAC, and a subscription-gated Premium Accounting / Tax / Audit module — replacing the
5–7 separate SaaS subscriptions a typical SMB stitches together.

> **Spec of record:** the contract is in [`docs/`](./docs/). Code follows docs, not vibes.

## Stack

Next.js 14 (App Router) + React 18 + TypeScript strict + Tailwind • Express 4 + Mongoose •
MongoDB 7 (Atlas) • Redis 7 + BullMQ • Socket.IO • Framer Motion + GSAP ScrollTrigger +
Spline • JWT RS256 + OAuth 2.0 PKCE + 2FA TOTP • AWS EKS + Terraform + ArgoCD/Helm •
Datadog + Sentry + OpenTelemetry. Full stack table in [`docs/03-technical/TRD.md`](./docs/03-technical/TRD.md#1-stack-summary).

## Quick start

```bash
# 1. Toolchain — Node 20.11, pnpm 9.7, Docker.
nvm use                                  # picks up .nvmrc
corepack enable && corepack prepare pnpm@9.7.0 --activate

# 2. Install workspaces.
pnpm install

# 3. Boot dev infra (Mongo replica set + Redis + MinIO + Mailhog).
pnpm docker:up

# 4. Seed env and run.
cp .env.example .env
pnpm dev                                 # turbo runs api + storefront in parallel
```

Live URLs once `pnpm dev` is up:

| Service     | URL                                  |
| ----------- | ------------------------------------ |
| API         | http://localhost:4000/healthz        |
| Smoke       | http://localhost:4000/api/v1/ping    |
| Storefront  | http://localhost:3000                |
| Storybook   | `pnpm --filter @unified/design-system storybook` → http://localhost:6006 |
| MinIO       | http://localhost:9001 (minio / minio12345) |
| Mailhog     | http://localhost:8025                |

## Repo layout

```
apps/
  api               Express + Mongoose REST API   (Phase 0 ✓)
  storefront        Next.js 14 SSR — customer     (Phase 0 ✓)
  admin             Next.js 14 SPA — admin        (Phase 1)
  accounting        Next.js 14 SPA — premium      (Phase 6)
  worker            BullMQ workers                (Phase 2)
  webhook           Inbound webhook service       (Phase 3)
packages/
  design-system     Neumorphic library + Storybook  (Phase 0 ✓)
  motion            Framer Motion + GSAP utilities  (Phase 0 ✓)
  ui-hooks          Shared React hooks              (Phase 0 ✓)
  shared-types      TS types + Zod schemas          (Phase 0 ✓)
  sdk               TS client from OpenAPI          (Phase 0 ✓)
  eslint-config     Shared ESLint configs           (Phase 0 ✓)
  tsconfig          Shared tsconfig bases           (Phase 0 ✓)
infra/
  terraform         AWS IaC (dev env)               (Phase 0 ✓)
  k8s/charts        Helm charts (api, storefront)   (Phase 0 ✓)
  docker            base images + dev compose       (Phase 0 ✓)
docs/               spec of record (PRD, TRD, …)
```

## Documentation map

| Folder | What's in it |
| --- | --- |
| `docs/01-business/`         | PRD, BRD, Scope |
| `docs/02-design/`           | Design system, wireframes |
| `docs/03-technical/`        | TRD, Architecture, Database, API |
| `docs/04-security/`         | Security requirements |
| `docs/05-devops/`           | Infrastructure, CI/CD |
| `docs/06-testing/`          | Test plan |
| `docs/07-monitoring/`       | Logging, observability |
| `docs/08-legal/`            | Terms, privacy |
| `docs/09-project-management/` | Roadmap, sprint plan, risk register |

## Conventions

- **TypeScript strict** everywhere. No `any` without an `eslint-disable` justification.
- **Conventional Commits** with a domain scope (`feat(auth): …`, `fix(payments): …`). The
  allowed scopes are in [`commitlint.config.cjs`](./commitlint.config.cjs).
- **Trunk-based dev.** Short-lived feature branches; PRs require passing CI + one
  approving review.
- **Coverage gates.** 80% statements on `apps/api`; 75% on `apps/storefront`,
  `apps/admin`, `apps/accounting`.
- **Deny-by-default RBAC.** Every API route is guarded by `requirePermission('domain.action')`;
  premium routes additionally call `requireEntitlement('feature_code')`.
- **Audit log every mutation.** Captured at the Mongoose middleware layer for premium
  scope; written to a dedicated cluster (Sprint 0 decision).
- **Idempotent webhooks.** Every inbound webhook verifies its signature and dedupes on
  the provider event ID.
- **PII never in logs.** Pino redaction list mirrors `docs/07-monitoring/Logging.md` §7.
- **No card data on our servers.** Stripe Elements only.

## Commands

```bash
pnpm dev              # turbo — api + storefront in parallel
pnpm build            # turbo — build every app + package
pnpm typecheck        # tsc --noEmit across the workspace
pnpm lint             # eslint across the workspace
pnpm test             # vitest across the workspace
pnpm test:coverage    # with coverage gates
pnpm format           # prettier write
pnpm docker:up        # local Mongo + Redis + MinIO + Mailhog
pnpm docker:down
```

Per-package: `pnpm --filter @unified/api dev`, `pnpm --filter @unified/storefront build`,
`pnpm --filter @unified/design-system storybook`, etc.

## Phase status

| Phase | Window | State |
| --- | --- | --- |
| 0 — Foundations            | 2w | **In Progress** (this PR) |
| 1 — Identity & RBAC        | 8w | Pending |
| 2 — Social Hub             | 10w | Pending |
| 3 — E-Commerce + Storefront | 12w | Pending |
| 4 — Order/Inventory/CRM    | 8w | Pending |
| 5 — Analytics              | 5w | Pending |
| 6 — Premium Accounting     | 10w | Pending |
| 7 — QA / Security / UAT    | 5w | Pending |

Detailed schedule in [`docs/09-project-management/Roadmap.md`](./docs/09-project-management/Roadmap.md).

## Sprint 0 decisions

Captured before scaffolding so the rest of the codebase inherits them:

1. **Cloud:** AWS primary (EKS + Atlas + ElastiCache + S3 + ACM).
2. **Audit log:** dedicated Atlas cluster with WORM-mounted object shards (Phase 6 lands
   the WORM mount; the cluster is provisioned now).
3. **Billing:** co-equal — Stripe + eSewa + Khalti share a common `BillingProvider`
   interface, materialised in Phase 6.
4. **Spline scene:** no asset yet — Hero ships a layered gradient + parallax placeholder
   under `apps/storefront/src/components/Hero.tsx` with a `TODO(design)` marker. Design
   handoff opened against this PR.

## License

UNLICENSED — proprietary to Elskov Services.
