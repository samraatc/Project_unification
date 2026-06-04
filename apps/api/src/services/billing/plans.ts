/**
 * Subscription plan catalogue — PRD §3.7.
 *
 * Amounts are in minor currency units (cents / paisa). `entitlements` is the
 * fully-expanded feature-code set the plan grants; the billing service writes
 * this onto the `subscriptions.entitlements` array verbatim so
 * `requireEntitlement(code)` is a simple Array.includes call.
 */

export type PlanCode = 'trial' | 'monthly' | 'yearly' | 'lifetime' | 'enterprise';

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  amountUsd: number; // minor units
  amountNpr: number; // minor units
  cycle: 'none' | 'monthly' | 'yearly' | 'one_off';
  seats: number;
  entitlements: readonly string[];
  trialDays?: number;
  bestFor?: string;
}

const CORE_ACCOUNTING = [
  'accounting.ledger',
  'accounting.journals',
  'accounting.reports.pl',
  'accounting.reports.balance_sheet',
  'accounting.reports.trial_balance',
  'accounting.reports.general_ledger',
  'accounting.bank_reconciliation',
];

const PREMIUM_ALL = [
  ...CORE_ACCOUNTING,
  'accounting.tax.vat200',
  'accounting.tax.gstr1',
  'accounting.tax.gstr3b',
  'accounting.tax.ird_einvoice',
  'accounting.reports.cash_flow',
  'accounting.reports.sub_ledger',
  'accounting.period_close',
  'accounting.audit',
  'accounting.audit_pack',
  'accounting.budgeting',
  'accounting.multi_currency',
];

export const PLANS: readonly PlanDefinition[] = [
  {
    code: 'trial',
    name: 'Free Trial',
    amountUsd: 0,
    amountNpr: 0,
    cycle: 'none',
    seats: 1,
    trialDays: 14,
    bestFor: 'Evaluation, 100 transactions cap',
    entitlements: CORE_ACCOUNTING,
  },
  {
    code: 'monthly',
    name: 'Monthly',
    amountUsd: 29_00,
    amountNpr: 3900_00,
    cycle: 'monthly',
    seats: 1,
    bestFor: 'Small business, 1 user',
    entitlements: CORE_ACCOUNTING,
  },
  {
    code: 'yearly',
    name: 'Yearly',
    amountUsd: 290_00,
    amountNpr: 39_000_00,
    cycle: 'yearly',
    seats: 3,
    bestFor: 'Growing SMB, 3 users, includes Tax Module',
    entitlements: [...CORE_ACCOUNTING, 'accounting.tax.vat200', 'accounting.tax.gstr1', 'accounting.tax.gstr3b', 'accounting.tax.ird_einvoice'],
  },
  {
    code: 'lifetime',
    name: 'Lifetime',
    amountUsd: 1499_00,
    amountNpr: 199_000_00,
    cycle: 'one_off',
    seats: 5,
    bestFor: 'Long-term commit, v1 bound',
    entitlements: PREMIUM_ALL,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    amountUsd: 0,
    amountNpr: 0,
    cycle: 'none',
    seats: 25,
    bestFor: 'Multi-entity / multi-currency, SSO, on-prem',
    entitlements: [...PREMIUM_ALL, 'accounting.multi_entity', 'accounting.sso'],
  },
] as const;

export function planFor(code: PlanCode): PlanDefinition {
  const p = PLANS.find((x) => x.code === code);
  if (!p) throw new Error(`Unknown plan: ${code}`);
  return p;
}

export const GRACE_PERIOD_DAYS = 7;
export const ARCHIVE_AFTER_DAYS = 14;
