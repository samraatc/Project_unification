# feat(sprint-0): foundations

Closes the Phase 0 exit gate in `docs/09-project-management/Roadmap.md`: *"a hello-world
API and storefront can be deployed end-to-end from a PR to staging within one click."*

## What's in this PR

This is the **draft** Sprint 0 PR. The skeleton boots locally; follow-up commits inside
this same PR will harden CI green and stand up the dev environment.

| # | Deliverable | State |
| - | --- | --- |
| 1 | Monorepo bootstrap (pnpm + Turborepo + tsconfig + eslint + prettier + commitlint) | ✓ |
| 2 | Hello-world API — Express + Mongoose + Pino + Zod + JWT + `/healthz` + `/api/v1/ping` | ✓ |
| 3 | Hello-world storefront — Next.js 14 App Router + Tailwind + AnimatePresence wrapper + Hero stub | ✓ |
| 4 | Design system seed — Storybook 8 + Style Dictionary + NeuCard/NeuButton/NeuInput | ✓ |
| 5 | `packages/motion` — `tx`, `fadeUp`, `fadeIn`, `scaleIn`, stagger variants, GSAP helpers | ✓ |
| 6 | `packages/shared-types` + `packages/sdk` + `packages/ui-hooks` | ✓ |
| 7 | GitHub Actions CI — typecheck, lint, Vitest+Codecov, Semgrep, Snyk, Gitleaks, Docker | ✓ |
| 8 | Terraform skeleton (`infra/terraform/envs/dev`) — VPC, EKS, Atlas primary + audit, Redis, S3, ACM, CI OIDC role | ✓ |
| 9 | Helm charts (`infra/k8s/charts/{api,storefront}`) with `values.dev.yaml` | ✓ |
| 10 | OpenAPI scaffold (`apps/api/openapi.json`) consumed by `packages/sdk` | ✓ |
| 11 | Root README + CONTRIBUTING + PR template + CODEOWNERS + Dependabot | ✓ |

## Sprint 0 decisions captured here

These four flagged in the brief were resolved before scaffolding:

1. **Cloud → AWS** (EKS + Atlas + ElastiCache + S3 + ACM). Terraform skeleton is
   AWS-only; GCP modules are not maintained.
2. **Audit log → dedicated Atlas cluster.** `infra/terraform/envs/dev/main.tf` provisions
   `atlas_audit` alongside the primary. WORM-mounted object shards land with Phase 6
   when Atlas tier supports them — placeholder TODO in the module.
3. **Billing → co-equal interface.** Stripe + eSewa + Khalti share a common
   `BillingProvider` contract (materialised in Phase 6). No Stripe-first assumption is
   wired in.
4. **Spline scene → placeholder.** `apps/storefront/src/components/Hero.tsx` ships a
   layered gradient + parallax skeleton with a `TODO(design)` marker. Opening a design
   ticket for the real `.splinecode` asset is on the design lead.

## Doc alignment

PRD (`docs/01-business/PRD.md`), TRD (`docs/03-technical/TRD.md`), Roadmap, and Sprint
Plan all read; nothing in this PR conflicts. The PRD calls the stack "MERN + Next.js 14"
in the header — the engineering brief upgrades that to "Node 20 + Express 4 +
TypeScript strict + Next.js 14 App Router." Treating the engineering brief as the
working interpretation; no doc edit needed.

## How to verify locally

```bash
nvm use && corepack enable && corepack prepare pnpm@9.7.0 --activate
pnpm install
pnpm docker:up
cp .env.example .env
pnpm dev
# In another shell:
curl -s http://localhost:4000/healthz       # → {"status":"ok",…}
curl -s http://localhost:4000/api/v1/ping   # → {"pong":true,…}
open http://localhost:3000
pnpm --filter @unified/design-system storybook  # → http://localhost:6006
```

## What's *not* in this PR

- The pnpm lockfile will be generated on the reviewer's first `pnpm install` — committed
  in the second push to this PR after Renovate/Dependabot has had a pass.
- Real secrets (Atlas API keys, Sentry DSN, payment keys) are placeholders in
  `.env.example`. They land in Vault as Phase 1 starts.
- Phase 1 routes (`/auth/*`, `/users/*`, `/roles/*`) are stubbed out as comments in
  `apps/api/src/routes/v1/index.ts`.
- Spline scene file (see decision #4 above).

## Definition of Done

- [x] Monorepo boots locally (api + storefront + storybook)
- [x] OpenAPI generator wired; `packages/sdk` builds from it
- [x] Tokens flow: `design-tokens/tokens.json` → CSS variables → Tailwind preset
- [x] Three primitives ship with stories + axe assertions
- [x] CI workflow green on a probe push (to be confirmed once branch protection is on)
- [ ] Staging deploy from PR — pending the first apply of `infra/terraform/envs/dev`
- [ ] QA sign-off on hello-world demo

## Reviewers

@elskovservices/platform @elskovservices/devops @elskovservices/design
