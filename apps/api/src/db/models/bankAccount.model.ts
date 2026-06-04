import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `bankAccounts` — Database.md §8.7. */
const BankAccountSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    name: { type: String, required: true },
    institutionName: String,
    accountNumberMasked: String,
    currency: { type: String, default: 'USD' },
    ledgerAccountId: { type: Schema.Types.ObjectId, ref: 'ChartOfAccounts', required: true },
    /** Last reconciliation watermark — auto-match runs forward from here. */
    lastReconciledAt: Date,
    openingBalanceMinor: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'bankAccounts' },
);

export type BankAccountDoc = InferSchemaType<typeof BankAccountSchema> & {
  _id: Schema.Types.ObjectId;
};
export const BankAccount: Model<BankAccountDoc> = model<BankAccountDoc>(
  'BankAccount',
  BankAccountSchema,
);
