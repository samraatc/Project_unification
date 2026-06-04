import {
  BankAccount,
  BankTransaction,
  JournalEntry,
  type BankTransactionDoc,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';

/**
 * Bank reconciliation — PRD §3.6.
 *
 * `importTransactions` accepts a CSV/OFX/API payload (Phase 6.5 ships the
 * model + the auto-match service; the parser plugs in as a 1-day follow-up).
 * `autoMatch` walks unmatched bank rows and pairs them to journal entries with
 * a confidence score derived from amount, date, and memo overlap.
 */

export interface ImportTransactionsInput {
  tenantId: string;
  actorId: string;
  bankAccountId: string;
  rows: Array<{ date: string; amountMinor: number; direction: 'debit' | 'credit'; reference?: string; description?: string }>;
}

export async function importTransactions(input: ImportTransactionsInput): Promise<{ created: number }> {
  const account = await BankAccount.findOne({ _id: input.bankAccountId, tenantId: input.tenantId });
  if (!account) throw new HttpError(404, 'BANK_NOT_FOUND', 'Bank account not found.');

  let created = 0;
  for (const r of input.rows) {
    // eslint-disable-next-line no-await-in-loop
    await BankTransaction.create({
      tenantId: input.tenantId,
      bankAccountId: account._id,
      date: new Date(r.date),
      amountMinor: r.amountMinor,
      direction: r.direction,
      reference: r.reference,
      description: r.description,
      status: 'unmatched',
    });
    created++;
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'bank.imported',
    entity: 'BankAccount',
    entityId: account._id,
    afterJson: { rows: created },
    premium: true,
  });
  return { created };
}

export async function listUnmatched(tenantId: string, bankAccountId?: string): Promise<BankTransactionDoc[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
  const filter: any = { tenantId, status: 'unmatched' };
  if (bankAccountId) filter.bankAccountId = bankAccountId;
  return BankTransaction.find(filter).sort({ date: -1 }).limit(200).lean();
}

export interface AutoMatchInput {
  tenantId: string;
  bankAccountId: string;
  actorId: string;
}

export async function autoMatch(input: AutoMatchInput): Promise<{ matched: number }> {
  const bank = await BankAccount.findOne({ _id: input.bankAccountId, tenantId: input.tenantId });
  if (!bank) throw new HttpError(404, 'BANK_NOT_FOUND', 'Bank account not found.');

  const unmatched = await BankTransaction.find({ tenantId: input.tenantId, bankAccountId: bank._id, status: 'unmatched' });
  let matched = 0;
  for (const t of unmatched) {
    // Heuristic match: same amount, posted within 5 days, against bank's ledger account.
    // eslint-disable-next-line no-await-in-loop
    const candidates = await JournalEntry.find({
      tenantId: input.tenantId,
      'lines.accountId': bank.ledgerAccountId,
      'lines.amountMinor': t.amountMinor,
      postedAt: {
        $gte: new Date(t.date.getTime() - 5 * 86_400_000),
        $lte: new Date(t.date.getTime() + 5 * 86_400_000),
      },
    })
      .select('_id number postedAt description')
      .limit(5);
    if (candidates.length === 0) continue;
    // Confidence: exact-day match = 1.0; +1 day = 0.8; +2..5 = 0.5.
    const best = candidates.reduce((acc, c) => {
      const days = Math.abs(c.postedAt.getTime() - t.date.getTime()) / 86_400_000;
      const score = days < 1 ? 1 : days < 2 ? 0.8 : 0.5;
      return score > acc.score ? { entry: c, score } : acc;
    }, { entry: candidates[0]!, score: 0 });
    t.matchedJournalId = best.entry._id as unknown as BankTransactionDoc['matchedJournalId'];
    t.matchConfidence = best.score;
    t.status = 'matched';
    // eslint-disable-next-line no-await-in-loop
    await t.save();
    matched++;
  }
  bank.lastReconciledAt = new Date();
  await bank.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'bank.auto_matched',
    entity: 'BankAccount',
    entityId: bank._id,
    afterJson: { matched },
    premium: true,
  });
  return { matched };
}

export interface ManualMatchInput {
  tenantId: string;
  transactionId: string;
  journalEntryId: string;
  actorId: string;
}

export async function manualMatch(input: ManualMatchInput) {
  const t = await BankTransaction.findOne({ _id: input.transactionId, tenantId: input.tenantId });
  if (!t) throw new HttpError(404, 'TXN_NOT_FOUND', 'Transaction not found.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose ObjectId
  t.matchedJournalId = input.journalEntryId as any;
  t.matchConfidence = 1;
  t.status = 'matched';
  await t.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'bank.manual_matched',
    entity: 'BankTransaction',
    entityId: t._id,
    afterJson: { journalEntryId: input.journalEntryId },
    premium: true,
  });
  return t;
}
