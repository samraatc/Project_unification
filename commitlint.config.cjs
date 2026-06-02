/**
 * Conventional Commits enforced per TRD §7.
 * Scopes track the domain modules from PRD §3 plus infra/ci.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'rbac',
        'catalogue',
        'cart',
        'checkout',
        'payments',
        'orders',
        'inventory',
        'social',
        'inbox',
        'crm',
        'accounting',
        'tax',
        'audit',
        'billing',
        'design-system',
        'motion',
        'storefront',
        'admin',
        'accounting-portal',
        'api',
        'worker',
        'webhook',
        'sdk',
        'shared-types',
        'infra',
        'ci',
        'docs',
        'release',
        'sprint-0',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
