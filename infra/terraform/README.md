# Terraform — Unified Platform Infra

AWS-first per Sprint 0 decision (see PR description). GCP is not maintained here.

## Layout

```
infra/terraform/
  modules/             reusable building blocks (vpc, eks, atlas, redis, s3, acm, ci-oidc)
  envs/
    dev/               small footprint, used by every developer + CI staging deploys
    staging/           (added in Phase 1)
    prod/              (added in Phase 7)
```

## State

Remote state lives in S3 + DynamoDB lock. Bootstrap the backend by hand the first time
(`terraform/envs/dev/backend.tf` references `terraform-state-unified-platform`).

## CI

`.github/workflows/terraform-plan.yml` runs `fmt → init → validate → plan` on every PR
touching `infra/terraform/**`. Apply runs only from a separate manual workflow on `main`
once #devops approves the plan.
