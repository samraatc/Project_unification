import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `bankTransactions` — Database.md §8.8. */
const BankTransactionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    bankAccountId: { type: Schema.Types.ObjectId, ref: 'BankAccount', required: true, index: true },
    date: { type: Date, required: true, index: true },
    amountMinor: { type: Number, required: true },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    reference: String,
    description: String,
    balanceAfterMinor: Number,
    matchedJournalId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    matchConfidence: { type: Number, min: 0, max: 1 },
    status: {
      type: String,
      enum: ['unmatched', 'matched', 'ignored'],
      default: 'unmatched',
      index: true,
    },
  },
  { timestamps: true, collection: 'bankTransactions' },
);

BankTransactionSchema.index({ tenantId: 1, status: 1, date: -1 });

export type BankTransactionDoc = InferSchemaType<typeof BankTransactionSchema> & {
  _id: Schema.Types.ObjectId;
};
export const BankTransaction: Model<BankTransactionDoc> = model<BankTransactionDoc>(
  'BankTransaction',
  BankTransactionSchema,
);
