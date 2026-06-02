# Deployment

**Project:** Unified Marketing & E-Commerce Management Platform
**CI/CD:** GitHub Actions → ArgoCD (GitOps) or Helm + kubectl direct
**Version:** 1.0

---

## 1. Branching & Release Model

Trunk-based development on `main`. Short-lived feature branches merge into `main` via PR with a passing CI and one approving review. Each merge to `main` triggers a build that produces a versioned artefact (Docker image) tagged with the commit SHA and a semantic version derived from Conventional Commits via `semantic-release`.

Production release is a manual promotion of a tagged artefact, not an automatic deploy on merge. This gives the team a controlled cadence (target: weekly Tuesday production releases) while keeping `main` always-deployable.

## 2. Pipeline Stages

The pipeline runs the following stages on every PR and push to `main`.

### 2.1 Validate (PR + push)

Install dependencies (cached). Type-check (`tsc --noEmit`). Lint (ESLint, Prettier check). Schema check (OpenAPI lint, Zod schema validation). Commit-message lint (commitlint).

### 2.2 Test (PR + push)

Unit tests (Vitest) with coverage gate (80% on `apps/api`, 75% on `apps/storefront` and `apps/admin`). Integration tests against an ephemeral Mongo + Redis (testcontainers). Contract tests asserting RBAC and entitlement guards on every premium route.

### 2.3 Security (PR + push)

SAST (Semgrep). Dependency scan (Snyk + `npm audit`). Secrets scan (Gitleaks). IaC scan (Checkov, tfsec) on any change under `/infra`.

### 2.4 Build (push to `main` and tags)

Build Docker images for `apps/api`, `apps/storefront`, `apps/admin`, `apps/accounting`, `apps/webhook`, `apps/worker`. Multi-stage with distroless or Alpine base. Image scan (Trivy). Sign image (cosign). Push to ECR (or GHCR).

### 2.5 Deploy — Preview (PR)

ArgoCD ApplicationSet provisions a preview namespace and deploys the PR's images. Preview URL posted as a PR comment. Auto-cleanup on merge or PR close.

### 2.6 Deploy — Staging (push to `main`)

Helm/ArgoCD deploys to staging. Smoke tests run against staging (`apps/api/test/smoke`). On failure, rollback to the previous revision and open an incident ticket.

### 2.7 Deploy — Production (manual promotion of a tag)

Manual workflow trigger with the tag to deploy. Confirmation prompt with diff of versions. Production deploy is canary: 10% traffic on the new revision for 10 minutes with error-rate and p95-latency budgets monitored; auto-rollback on budget breach; promote to 100% on success.

## 3. Image Build

Each app has a `Dockerfile` in its app folder. Builds are multi-stage:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter ./apps/api build

FROM gcr.io/distroless/nodejs20
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
USER nonroot
EXPOSE 8080
CMD ["dist/main.js"]
```

Images are signed with cosign keyless against the GitHub OIDC issuer. Kubernetes admission verifies the signature.

## 4. GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml (excerpt)
name: CI
on: [pull_request, push]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck && pnpm lint
  test:
    needs: validate
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports: [27017:27017]
      redis:
        image: redis:7
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --coverage
      - uses: codecov/codecov-action@v4
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
      - uses: returntocorp/semgrep-action@v1
      - uses: gitleaks/gitleaks-action@v2
  build:
    if: github.ref == 'refs/heads/main'
    needs: [test, security]
    runs-on: ubuntu-latest
    permissions: { id-token: write, packages: write }
    strategy:
      matrix: { app: [api, storefront, admin, accounting, webhook, worker] }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with: { role-to-assume: ${{ vars.AWS_DEPLOY_ROLE }}, aws-region: us-east-1 }
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ${{ vars.ECR }}/${{ matrix.app }}:${{ github.sha }}
      - uses: sigstore/cosign-installer@v3
      - run: cosign sign --yes ${{ vars.ECR }}/${{ matrix.app }}:${{ github.sha }}
```

## 5. Helm / ArgoCD

Each app has a Helm chart under `infra/k8s/charts/<app>`. ArgoCD applications point to the chart in the repo and the values file per environment. Sync waves: namespaces → secrets (External Secrets Operator) → CRDs → workloads. Sync policy: automated in dev/preview, manual in staging (after smoke gate) and production (after canary gate).

Helm values per environment (excerpt):

```yaml
# values.prod.yaml
replicaCount: 3
image:
  repository: <ecr>/api
  tag: <set-by-ci>
resources:
  requests: { cpu: 250m, memory: 512Mi }
  limits:   { cpu: 1000m, memory: 1Gi }
hpa:
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
env:
  NODE_ENV: production
secretRefs:
  - mongo-uri
  - redis-url
  - jwt-private-key
  - stripe-secret
```

## 6. Database Migrations

Mongo schema changes ship via `migrate-mongo`. Migrations are forward-only; rollback is documented per migration. The release pipeline runs migrations as a Kubernetes Job before the new revision pods start serving traffic; if the migration fails, the job retries up to three times and then fails the deploy.

Long-running backfills (e.g., indexing a new field on a large collection) run as separate BullMQ jobs that are decoupled from the release. The release deploys the new code with backward-compatible reads (both old and new shape supported) and the backfill runs at safe concurrency; a follow-up release tightens reads to the new shape after the backfill completes.

## 7. Secrets Management

Secrets are stored in HashiCorp Vault (or AWS Secrets Manager). The External Secrets Operator syncs them into Kubernetes Secret resources at runtime. Pods consume secrets as environment variables or mounted files. No plaintext secret is ever written into a Helm values file or committed to git.

Rotation cadence: JWT signing keys every 90 days (with overlap window for in-flight tokens); database credentials every 60 days; third-party API keys quarterly or on incident. Rotation procedures documented in `07-monitoring/Incident-Response.md`.

## 8. Configuration

Twelve-factor: config via environment variables. A typed config loader (`@platform/config`) reads env at startup and validates against a Zod schema; misconfiguration fails fast with a clear error.

Feature flags (`featureFlags` collection in Mongo, with Redis cache) gate experimental or per-tenant feature rollout. Flags evaluated on each request; cached for 30 seconds.

## 9. Deployment Strategy

Storefront and API use **canary** with traffic-shifting at the ingress level: 10% of traffic to the new revision for 10 minutes, monitored by Datadog SLO burn rate and error budget; auto-rollback on breach; promote on success. Workers use **blue-green** — new worker deployment runs alongside the old until a confidence window passes, then the old is scaled to zero. Database migrations use **expand-contract**: expand the schema to support old and new shape, ship code, backfill, ship code that uses only the new shape, contract the schema.

## 10. Rollback

A rollback is a one-command operation: `argocd app rollback platform-api <previous-revision>` or `helm rollback platform-api <revision>`. The previous five revisions are always retained. The on-call runbook walks through rollback with a verification checklist (smoke test, error rate, customer impact). A rollback is recorded in the incident timeline; if migrations were applied, the rollback may require a forward-fix rather than a true revert and the playbook covers that scenario.

## 11. Release Checklist

The release engineer for the week is responsible for the following checklist:

The CI pipeline is green on the candidate commit; staging smoke tests pass; the release notes are drafted; any database migration has been reviewed and a backfill plan exists if needed; on-call has been notified; the status page draft is ready; the customer-facing change-log entry is queued; a one-line summary of the deploy is posted to `#releases` Slack.

## 12. Post-Deploy Validation

Within 10 minutes of a production deploy, the on-call: confirms error rate within budget on the Datadog dashboard; confirms p95 latency within budget; spot-checks a customer purchase end-to-end on production with a test card; spot-checks an admin login; spot-checks a social post publish via a sandbox account.

## 13. Disaster Recovery

DR procedures, RPO/RTO targets, and the cross-region restore playbook are in `05-devops/Backup-Recovery.md`. A DR drill is executed quarterly and counted as a release-gate prerequisite for the next quarter.
