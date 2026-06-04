import { randomBytes } from 'node:crypto';

import { Types } from 'mongoose';

import {
  AccountingPeriod,
  ChartOfAccounts,
  JournalEntry,
  type JournalEntryDoc,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { ACCOUNT_HINTS, COA_TEMPLATES, type CoaTemplateKey } from './templates.js';

/**
 * Ledger service — core double-entry posting + CoA + period guard.
 *
 * Every journal entry obeys the immutable rule: sum(dr) === sum(cr). Auto-journal
 * sources dedupe on `(source, sourceEventId)` via the unique index.
 */

function makeEntryNumber(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

/* -------------------------------------------------------------------------- */
/* CoA bootstrap                                                              */
/* -------------------------------------------------------------------------- */

export interface SeedTemplateInput {
  tenantId: string;
  actorId: string;
  template: CoaTemplateKey;
  ip?: string;
  ua?: string;
}

export async function seedCoaTemplate(input: SeedTemplateInput) {
  const seeds = COA_TEMPLATES[input.template];
  const byCode = new Map<string, Types.ObjectId>();
  // Pass 1 — insert without parents.
  for (const s of seeds) {
    // eslint-disable-next-line no-await-in-loop
    const doc = await ChartOfAccounts.findOneAndUpdate(
      { tenantId: input.tenantId, code: s.code },
      {
        $setOnInsert: {
          tenantId: input.tenantId,
          code: s.code,
          name: s.name,
          type: s.type,
          normalSide: s.normalSide,
          isSystem: true,
          depth: 0,
        },
      },
      { upsert: true, new: true },
    );
    byCode.set(s.code, doc._id as unknown as Types.ObjectId);
  }
  // Pass 2 — resolve parents + path[].
  for (const s of seeds) {
    if (!s.parent) continue;
    const parentId = byCode.get(s.parent);
    const childId = byCode.get(s.code);
    if (!parentId || !childId) continue;
    // eslint-disable-next-line no-await-in-loop
    await ChartOfAccounts.updateOne(
      { _id: childId },
      { $set: { parent: parentId, path: [parentId], depth: 1 } },
    );
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'coa.seeded',
    entity: 'ChartOfAccounts',
    afterJson: { template: input.template, accounts: seeds.length },
    ip: input.ip,
    ua: input.ua,
  });
  return { accounts: seeds.length };
}

export async function getAccountByCode(tenantId: string, code: string) {
  return ChartOfAccounts.findOne({ tenantId, code }).select('_id code name type normalSide').lean();
}

/* -------------------------------------------------------------------------- */
/* Posting                                                                    */
/* -------------------------------------------------------------------------- */

export interface JournalLineInput {
  accountId?: string;
  /** Account code is resolved to id if `accountId` is not given. */
  accountCode?: string;
  side: 'dr' | 'cr';
  amountMinor: number;
  currency?: string;
  fxRate?: number;
  memo?: string;
}

export interface PostJournalInput {
  tenantId: string;
  actorId?: string;
  source: JournalEntryDoc['source'];
  sourceEventId?: string;
  description: string;
  reference?: string;
  lines: JournalLineInput[];
  status?: 'draft' | 'posted';
  ip?: string;
  ua?: string;
}

export async function postJournalEntry(input: PostJournalInput): Promise<JournalEntryDoc> {
  if (input.lines.length < 2) {
    throw new HttpError(400, 'INSUFFICIENT_LINES', 'A journal entry needs at least two lines.');
  }

  // Resolve account ids + validate.
  const resolved: Array<{ accountId: Types.ObjectId; side: 'dr' | 'cr'; amountMinor: number; currency: string; fxRate: number; memo?: string }> = [];
  for (const line of input.lines) {
    if (line.amountMinor <= 0) {
      throw new HttpError(400, 'NEGATIVE_AMOUNT', 'Line amounts must be positive minor units (D-0017).');
    }
    let accountId: Types.ObjectId | null = line.accountId ? new Types.ObjectId(line.accountId) : null;
    if (!accountId && line.accountCode) {
      // eslint-disable-next-line no-await-in-loop
      const acct = await ChartOfAccounts.findOne({ tenantId: input.tenantId, code: line.accountCode }).select('_id');
      if (!acct) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', `Account ${line.accountCode} not found.`);
      accountId = acct._id as unknown as Types.ObjectId;
    }
    if (!accountId) throw new HttpError(400, 'NO_ACCOUNT', 'Each line needs accountId or accountCode.');
    resolved.push({
      accountId,
      side: line.side,
      amountMinor: line.amountMinor,
      currency: line.currency ?? 'USD',
      fxRate: line.fxRate ?? 1,
      memo: line.memo,
    });
  }

  // Balance check — same-currency convertible totals.
  const drTotal = resolved.filter((l) => l.side === 'dr').reduce((s, l) => s + l.amountMinor * l.fxRate, 0);
  const crTotal = resolved.filter((l) => l.side === 'cr').reduce((s, l) => s + l.amountMinor * l.fxRate, 0);
  if (Math.round(drTotal) !== Math.round(crTotal)) {
    throw new HttpError(400, 'UNBALANCED_ENTRY', `Debits (${drTotal}) ≠ Credits (${crTotal}).`);
  }

  // Period guard — refuse to post into a locked period.
  const period = await AccountingPeriod.findOne({
    tenantId: input.tenantId,
    startsAt: { $lte: new Date() },
    endsAt: { $gte: new Date() },
  });
  if (period?.status === 'locked' || period?.status === 'closed') {
    throw new HttpError(409, 'PERIOD_LOCKED', 'Cannot post into a closed or locked period.');
  }

  const entry = await JournalEntry.create({
    tenantId: input.tenantId,
    number: makeEntryNumber('JE'),
    postedAt: new Date(),
    periodId: period?._id,
    reference: input.reference,
    source: input.source,
    sourceEventId: input.sourceEventId,
    description: input.description,
    lines: resolved,
    createdBy: input.actorId,
    status: input.status ?? 'posted',
  }).catch((err) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose duplicate-key
    if ((err as any)?.code === 11000) {
      return null; // already posted for this source event — idempotent
    }
    throw err;
  });

  if (!entry) {
    const existing = await JournalEntry.findOne({
      tenantId: input.tenantId,
      source: input.source,
      sourceEventId: input.sourceEventId,
    });
    if (!existing) throw new HttpError(500, 'JOURNAL_POST_FAILED', 'Could not post entry.');
    return existing;
  }

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'ledger.journal_posted',
    entity: 'JournalEntry',
    entityId: entry._id,
    afterJson: { source: input.source, lines: resolved.length, drTotal },
    ip: input.ip,
    ua: input.ua,
    premium: true,
  });
  return entry;
}

export async function reverseJournalEntry(input: { entryId: string; tenantId: string; actorId: string; ip?: string; ua?: string }): Promise<JournalEntryDoc> {
  const original = await JournalEntry.findOne({ _id: input.entryId, tenantId: input.tenantId });
  if (!original) throw new HttpError(404, 'ENTRY_NOT_FOUND', 'Entry not found.');
  if (original.status !== 'posted') throw new HttpError(409, 'NOT_POSTED', 'Only posted entries can be reversed.');

  const reverseLines = original.lines.map((l) => ({
    accountId: l.accountId,
    side: l.side === 'dr' ? ('cr' as const) : ('dr' as const),
    amountMinor: l.amountMinor,
    currency: l.currency,
    fxRate: l.fxRate ?? 1,
    memo: `Reversal of ${original.number}`,
  }));
  const reversal = await JournalEntry.create({
    tenantId: input.tenantId,
    number: makeEntryNumber('JR'),
    postedAt: new Date(),
    periodId: original.periodId,
    source: 'manual',
    sourceEventId: `reversal:${input.entryId}`,
    description: `Reversal of ${original.number}`,
    lines: reverseLines,
    createdBy: input.actorId,
    status: 'posted',
    reversalOf: original._id,
  });
  original.status = 'reversed';
  await original.save();

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'ledger.journal_reversed',
    entity: 'JournalEntry',
    entityId: original._id,
    afterJson: { reversalId: String(reversal._id) },
    ip: input.ip,
    ua: input.ua,
    premium: true,
  });
  return reversal;
}

/* -------------------------------------------------------------------------- */
/* Auto-journal handlers                                                       */
/* -------------------------------------------------------------------------- */

async function accountIdByHint(tenantId: string, hint: keyof typeof ACCOUNT_HINTS) {
  const acct = await ChartOfAccounts.findOne({ tenantId, code: ACCOUNT_HINTS[hint] }).select('_id');
  return acct?._id;
}

export interface OrderPaidEvent {
  tenantId: string;
  orderId: string;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  currency: string;
}

export async function recordOrderPaid(evt: OrderPaidEvent): Promise<void> {
  // Cash/clearing -> Sales / VAT
  const cashId = await accountIdByHint(evt.tenantId, 'gatewayClearing');
  const salesId = await accountIdByHint(evt.tenantId, 'sales');
  const vatId = await accountIdByHint(evt.tenantId, 'vatPayable');
  const shippingId = await accountIdByHint(evt.tenantId, 'shipping');
  if (!cashId || !salesId) return; // CoA not seeded yet — silently skip
  const lines: JournalLineInput[] = [
    { accountId: String(cashId), side: 'dr', amountMinor: evt.total, currency: evt.currency },
    {
      accountId: String(salesId),
      side: 'cr',
      amountMinor: evt.subtotal - evt.discount,
      currency: evt.currency,
    },
  ];
  if (evt.tax > 0 && vatId) {
    lines.push({ accountId: String(vatId), side: 'cr', amountMinor: evt.tax, currency: evt.currency });
  }
  if (evt.deliveryFee > 0 && shippingId) {
    lines.push({ accountId: String(shippingId), side: 'cr', amountMinor: evt.deliveryFee, currency: evt.currency });
  }
  await postJournalEntry({
    tenantId: evt.tenantId,
    source: 'order',
    sourceEventId: `order_paid:${evt.orderId}`,
    description: `Order paid ${evt.orderId}`,
    reference: evt.orderId,
    lines,
  });
}

export interface RefundEvent {
  tenantId: string;
  orderId: string;
  refundId: string;
  amount: number;
  currency: string;
}

export async function recordRefund(evt: RefundEvent): Promise<void> {
  const cashId = await accountIdByHint(evt.tenantId, 'gatewayClearing');
  const returnsId = await accountIdByHint(evt.tenantId, 'salesReturns');
  if (!cashId || !returnsId) return;
  await postJournalEntry({
    tenantId: evt.tenantId,
    source: 'refund',
    sourceEventId: `refund:${evt.refundId}`,
    description: `Refund for order ${evt.orderId}`,
    reference: evt.refundId,
    lines: [
      { accountId: String(returnsId), side: 'dr', amountMinor: evt.amount, currency: evt.currency },
      { accountId: String(cashId), side: 'cr', amountMinor: evt.amount, currency: evt.currency },
    ],
  });
}

export interface PoReceiveEvent {
  tenantId: string;
  poId: string;
  totalCost: number;
  currency: string;
}

export async function recordPoReceive(evt: PoReceiveEvent): Promise<void> {
  const inventoryId = await accountIdByHint(evt.tenantId, 'inventory');
  const apId = await accountIdByHint(evt.tenantId, 'accountsPayable');
  if (!inventoryId || !apId) return;
  await postJournalEntry({
    tenantId: evt.tenantId,
    source: 'po_receive',
    sourceEventId: `po_receive:${evt.poId}`,
    description: `PO receive ${evt.poId}`,
    reference: evt.poId,
    lines: [
      { accountId: String(inventoryId), side: 'dr', amountMinor: evt.totalCost, currency: evt.currency },
      { accountId: String(apId), side: 'cr', amountMinor: evt.totalCost, currency: evt.currency },
    ],
  });
}

export interface StockWriteOffEvent {
  tenantId: string;
  movementId: string;
  cost: number;
  currency: string;
}

export async function recordStockWriteOff(evt: StockWriteOffEvent): Promise<void> {
  const writeOffId = await accountIdByHint(evt.tenantId, 'inventoryWriteOff');
  const inventoryId = await accountIdByHint(evt.tenantId, 'inventory');
  if (!writeOffId || !inventoryId) return;
  await postJournalEntry({
    tenantId: evt.tenantId,
    source: 'stock_writeoff',
    sourceEventId: `stock_writeoff:${evt.movementId}`,
    description: 'Stock write-off',
    reference: evt.movementId,
    lines: [
      { accountId: String(writeOffId), side: 'dr', amountMinor: evt.cost, currency: evt.currency },
      { accountId: String(inventoryId), side: 'cr', amountMinor: evt.cost, currency: evt.currency },
    ],
  });
}

export interface PayoutEvent {
  tenantId: string;
  payoutId: string;
  amount: number;
  currency: string;
  fees: number;
}

export async function recordPayout(evt: PayoutEvent): Promise<void> {
  const bankId = await accountIdByHint(evt.tenantId, 'cash');
  const clearingId = await accountIdByHint(evt.tenantId, 'gatewayClearing');
  const feesId = await accountIdByHint(evt.tenantId, 'paymentFees');
  if (!bankId || !clearingId) return;
  const lines: JournalLineInput[] = [
    { accountId: String(bankId), side: 'dr', amountMinor: evt.amount, currency: evt.currency },
    { accountId: String(clearingId), side: 'cr', amountMinor: evt.amount + evt.fees, currency: evt.currency },
  ];
  if (evt.fees > 0 && feesId) {
    lines.push({ accountId: String(feesId), side: 'dr', amountMinor: evt.fees, currency: evt.currency });
  }
  await postJournalEntry({
    tenantId: evt.tenantId,
    source: 'payout',
    sourceEventId: `payout:${evt.payoutId}`,
    description: `Gateway payout ${evt.payoutId}`,
    reference: evt.payoutId,
    lines,
  });
}
