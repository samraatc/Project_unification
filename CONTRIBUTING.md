# Contributing

## Branching

Trunk-based. `main` is always deployable. Feature branches are short-lived and named
`feat/<scope>-<topic>`, `fix/<scope>-<topic>`, or `chore/<scope>-<topic>`.

## Commits

Conventional Commits with a domain scope. The allowed scopes are enforced by
[`commitlint.config.cjs`](./commitlint.config.cjs) and run on every PR.

```
feat(auth): add 2FA TOTP enrolment endpoint
fix(payments): retry Khalti lookup on 5xx
docs(api): document /orders state machine
```

## Pull requests

- One reviewer minimum. CI must be green.
- Use the PR template; tick the FR reference, RBAC + audit + idempotency boxes.
- Definition of Done is in the [project brief](./README.md) and
  [`docs/09-project-management/Sprint-Plan.md`](./docs/09-project-management/Sprint-Plan.md).

## Local checks

```bash
pnpm typecheck && pnpm lint && pnpm test
```

The Husky pre-commit hook runs lint-staged (Prettier + ESLint --fix) on changed files
and validates the commit message format.

## Reporting issues

Use the Linear/Jira workspace. Security issues go to elskovservices@gmail.com — do not
file a public issue.
