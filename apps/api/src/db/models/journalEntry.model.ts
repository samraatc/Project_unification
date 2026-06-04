import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `journalEntries` — Database.md §8.3.
 *
 * Each entry contains 2+ lines whose debit sum equals the credit sum (D-0017:
 * amounts are positive minor-unit integers; the `side` enum tells the ledger
 * which way the line goes). Posted entries are immutable; the `reverseEntry`
 * service writes a reversing entry instead.
 *
 * Auto-journal sources (`order`, `refund`, `payout`, `stock_writeoff`,
 * `po_receive`) are deduped on `(source, reference)` so re-emitted events are
 * no-ops.
 */
const LineSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'ChartOfAccounts', required: true },
    /** D-0017 — positive minor units only; `side` controls the polarity. */
    side: { type: String, enum: ['dr', 'cr'], required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    /** FX rate applied to convert into the period's reporting currency. */
    fxRate: { type: Number, default: 1 },
    memo: String,
  },
  { _id: true },
);

const JournalEntrySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    number: { type: String, required: true },
    postedAt: { type: Date, default: Date.now, index: true },
    periodId: { type: Schema.Types.ObjectId, ref: 'AccountingPeriod', index: true },
    reference: String,
    source: {
      type: String,
      enum: ['order', 'refund', 'payout', 'stock_writeoff', 'po_receive', 'manual', 'recurring'],
      required: true,
      index: true,
    },
    /** Idempotency key for auto-journal — `<source>:<sourceId>`. */
    sourceEventId: { type: String, index: true },
    description: String,
    lines: { type: [LineSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['draft', 'posted', 'reversed'],
      default: 'posted',
      index: true,
    },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    /** Set when the entry is part of a tamper-evident chain (premium audit). */
    chainPrevHash: String,
    chainHash: String,
  },
  { timestamps: true, collection: 'journalEntries' },
);

JournalEntrySchema.index({ tenantId: 1, postedAt: -1 });
JournalEntrySchema.index({ tenantId: 1, source: 1, sourceEventId: 1 }, { unique: true, sparse: true });

export type JournalEntryDoc = InferSchemaType<typeof JournalEntrySchema> & {
  _id: Schema.Types.ObjectId;
};
export const JournalEntry: Model<JournalEntryDoc> = model<JournalEntryDoc>(
  'JournalEntry',
  JournalEntrySchema,
);
