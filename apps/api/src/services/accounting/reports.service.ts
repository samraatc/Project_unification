import { ChartOfAccounts, JournalEntry, type ChartOfAccountsDoc } from '../../db/models/index.js';

/**
 * Accounting reports — PRD §3.6.
 *
 * Builds Trial Balance, P&L, Balance Sheet, Cash Flow, General Ledger, and
 * Sub-Ledger from `journalEntries` aggregations. All numbers are minor-unit
 * integers; the portal converts at render time.
 */

export interface ReportRange {
  tenantId: string;
  from?: Date;
  to?: Date;
  asOf?: Date;
}

type BalanceRow = { accountId: string; code: string; name: string; type: ChartOfAccountsDoc['type']; debit: number; credit: number; balance: number };

async function aggregateBalances(range: ReportRange): Promise<BalanceRow[]> {
  const match: Record<string, unknown> = { tenantId: range.tenantId, status: 'posted' };
  if (range.from || range.to || range.asOf) {
    const postedAt: Record<string, Date> = {};
    if (range.from) postedAt.$gte = range.from;
    if (range.to ?? range.asOf) postedAt.$lte = range.to ?? range.asOf!;
    match.postedAt = postedAt;
  }
  const rows = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountId',
        debit: { $sum: { $cond: [{ $eq: ['$lines.side', 'dr'] }, { $multiply: ['$lines.amountMinor', { $ifNull: ['$lines.fxRate', 1] }] }, 0] } },
        credit: { $sum: { $cond: [{ $eq: ['$lines.side', 'cr'] }, { $multiply: ['$lines.amountMinor', { $ifNull: ['$lines.fxRate', 1] }] }, 0] } },
      },
    },
    {
      $lookup: { from: 'chartOfAccounts', localField: '_id', foreignField: '_id', as: 'acct' },
    },
    { $project: { debit: 1, credit: 1, acct: { $arrayElemAt: ['$acct', 0] } } },
  ]);
  return rows.map((r: { _id: string; debit: number; credit: number; acct?: { code: string; name: string; type: ChartOfAccountsDoc['type']; normalSide: 'dr' | 'cr' } }) => {
    const balance = r.acct?.normalSide === 'dr' ? r.debit - r.credit : r.credit - r.debit;
    return {
      accountId: String(r._id),
      code: r.acct?.code ?? '',
      name: r.acct?.name ?? '',
      type: r.acct?.type ?? 'asset',
      debit: r.debit,
      credit: r.credit,
      balance,
    };
  });
}

/* -------------------------------------------------------------------------- */

export async function trialBalance(range: ReportRange) {
  const rows = await aggregateBalances(range);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return {
    asOf: (range.to ?? range.asOf ?? new Date()).toISOString(),
    accounts: rows.sort((a, b) => a.code.localeCompare(b.code)),
    totals: { debit: totalDebit, credit: totalCredit, balanced: totalDebit === totalCredit },
  };
}

export async function profitAndLoss(range: ReportRange) {
  const rows = await aggregateBalances(range);
  const revenue = rows.filter((r) => r.type === 'revenue').reduce((s, r) => s + r.balance, 0);
  const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.balance, 0);
  return {
    period: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    revenue,
    expense,
    netIncome: revenue - expense,
    accounts: rows.filter((r) => r.type === 'revenue' || r.type === 'expense'),
  };
}

export async function balanceSheet(range: ReportRange) {
  const rows = await aggregateBalances(range);
  const assets = rows.filter((r) => r.type === 'asset').reduce((s, r) => s + r.balance, 0);
  const liabilities = rows.filter((r) => r.type === 'liability').reduce((s, r) => s + r.balance, 0);
  const equity = rows.filter((r) => r.type === 'equity').reduce((s, r) => s + r.balance, 0);
  return {
    asOf: (range.asOf ?? range.to ?? new Date()).toISOString(),
    assets,
    liabilities,
    equity,
    balanced: assets === liabilities + equity,
    accounts: rows.filter((r) => r.type === 'asset' || r.type === 'liability' || r.type === 'equity'),
  };
}

export async function cashFlow(range: ReportRange) {
  // Simplified direct-method cash flow: inflows = revenue + AR decrease; outflows = expense.
  const rows = await aggregateBalances(range);
  const inflows = rows.filter((r) => r.type === 'revenue').reduce((s, r) => s + r.balance, 0);
  const outflows = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.balance, 0);
  return {
    period: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    inflows,
    outflows,
    netCash: inflows - outflows,
  };
}

export async function generalLedger(range: ReportRange & { accountId: string }) {
  const entries = await JournalEntry.find({
    tenantId: range.tenantId,
    'lines.accountId': range.accountId,
    status: 'posted',
    postedAt: { $gte: range.from ?? new Date(0), $lte: range.to ?? new Date() },
  })
    .sort({ postedAt: 1 })
    .lean();
  let running = 0;
  const rows = entries.flatMap((e) =>
    (e.lines ?? []).filter((l) => String(l.accountId) === range.accountId).map((l) => {
      const delta = l.side === 'dr' ? l.amountMinor : -l.amountMinor;
      running += delta;
      return {
        entryNumber: e.number,
        postedAt: e.postedAt,
        description: e.description,
        debit: l.side === 'dr' ? l.amountMinor : 0,
        credit: l.side === 'cr' ? l.amountMinor : 0,
        runningBalance: running,
      };
    }),
  );
  return { accountId: range.accountId, rows };
}

export async function subLedger(range: ReportRange & { accountType: ChartOfAccountsDoc['type'] }) {
  const accounts = await ChartOfAccounts.find({ tenantId: range.tenantId, type: range.accountType, isActive: true })
    .select('_id code name')
    .lean();
  const balances = await aggregateBalances(range);
  return accounts.map((a) => ({
    accountId: String(a._id),
    code: a.code,
    name: a.name,
    ...(balances.find((b) => b.accountId === String(a._id)) ?? { debit: 0, credit: 0, balance: 0 }),
  }));
}
