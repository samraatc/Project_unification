/**
 * Built-in Chart of Accounts templates (PRD §3.6 / D-0016).
 *
 * Each template seeds a tenant's `chartOfAccounts` on first premium activation.
 * The numbering follows the AICPA-aligned scheme:
 *   1xxx Assets · 2xxx Liabilities · 3xxx Equity · 4xxx Revenue · 5xxx Expenses
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type CoaTemplateKey = 'retail' | 'services' | 'manufacturing';

export interface CoaSeed {
  code: string;
  name: string;
  type: AccountType;
  normalSide: 'dr' | 'cr';
  parent?: string;
}

const COMMON: CoaSeed[] = [
  { code: '1000', name: 'Cash', type: 'asset', normalSide: 'dr' },
  { code: '1010', name: 'Bank — operating', type: 'asset', normalSide: 'dr', parent: '1000' },
  { code: '1020', name: 'Payment gateway clearing', type: 'asset', normalSide: 'dr', parent: '1000' },
  { code: '1100', name: 'Accounts receivable', type: 'asset', normalSide: 'dr' },
  { code: '1200', name: 'Inventory — finished goods', type: 'asset', normalSide: 'dr' },
  { code: '2000', name: 'Accounts payable', type: 'liability', normalSide: 'cr' },
  { code: '2100', name: 'Sales tax / VAT payable', type: 'liability', normalSide: 'cr' },
  { code: '2200', name: 'Customer deposits', type: 'liability', normalSide: 'cr' },
  { code: '3000', name: 'Owner equity', type: 'equity', normalSide: 'cr' },
  { code: '3100', name: 'Retained earnings', type: 'equity', normalSide: 'cr' },
  { code: '4000', name: 'Sales revenue', type: 'revenue', normalSide: 'cr' },
  { code: '4100', name: 'Sales discounts', type: 'revenue', normalSide: 'dr', parent: '4000' },
  { code: '4200', name: 'Sales returns and allowances', type: 'revenue', normalSide: 'dr', parent: '4000' },
  { code: '5000', name: 'Cost of goods sold', type: 'expense', normalSide: 'dr' },
  { code: '5100', name: 'Inventory write-off', type: 'expense', normalSide: 'dr' },
  { code: '5200', name: 'Payment processing fees', type: 'expense', normalSide: 'dr' },
  { code: '5300', name: 'Shipping expense', type: 'expense', normalSide: 'dr' },
  { code: '6000', name: 'Operating expense', type: 'expense', normalSide: 'dr' },
];

const RETAIL_EXTRA: CoaSeed[] = [
  { code: '1210', name: 'Inventory — retail floor', type: 'asset', normalSide: 'dr', parent: '1200' },
  { code: '5110', name: 'Retail shrinkage', type: 'expense', normalSide: 'dr', parent: '5100' },
];

const SERVICES_EXTRA: CoaSeed[] = [
  { code: '4300', name: 'Service revenue', type: 'revenue', normalSide: 'cr' },
  { code: '6100', name: 'Subcontractor expense', type: 'expense', normalSide: 'dr' },
];

const MANUFACTURING_EXTRA: CoaSeed[] = [
  { code: '1220', name: 'Raw materials inventory', type: 'asset', normalSide: 'dr', parent: '1200' },
  { code: '1230', name: 'Work-in-progress inventory', type: 'asset', normalSide: 'dr', parent: '1200' },
  { code: '5400', name: 'Direct labour', type: 'expense', normalSide: 'dr' },
  { code: '5500', name: 'Manufacturing overhead', type: 'expense', normalSide: 'dr' },
];

export const COA_TEMPLATES: Record<CoaTemplateKey, CoaSeed[]> = {
  retail: [...COMMON, ...RETAIL_EXTRA],
  services: [...COMMON, ...SERVICES_EXTRA],
  manufacturing: [...COMMON, ...MANUFACTURING_EXTRA],
};

/** Account codes the auto-journal handlers look up by purpose. */
export const ACCOUNT_HINTS = {
  cash: '1010',
  gatewayClearing: '1020',
  accountsReceivable: '1100',
  inventory: '1200',
  accountsPayable: '2000',
  vatPayable: '2100',
  sales: '4000',
  salesReturns: '4200',
  cogs: '5000',
  inventoryWriteOff: '5100',
  paymentFees: '5200',
  shipping: '5300',
} as const;
