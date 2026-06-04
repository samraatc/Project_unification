import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `chartOfAccounts` — Database.md §8.2.
 *
 * Account numbering follows D-0016: 1xxx Assets, 2xxx Liabilities, 3xxx Equity,
 * 4xxx Revenue, 5xxx Expenses. The `parent` ref + `path[]` lets the trial balance
 * roll up sub-accounts.
 */
const CoaSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      required: true,
    },
    /** `dr` accounts (assets, expenses) increase on debit; `cr` accounts on credit. */
    normalSide: { type: String, enum: ['dr', 'cr'], required: true },
    parent: { type: Schema.Types.ObjectId, ref: 'ChartOfAccounts', default: null, index: true },
    path: { type: [Schema.Types.ObjectId], default: [] },
    depth: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    description: String,
    isActive: { type: Boolean, default: true },
    /** True if seeded by a template — admin UI locks the code/type. */
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'chartOfAccounts' },
);

CoaSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export type ChartOfAccountsDoc = InferSchemaType<typeof CoaSchema> & {
  _id: Schema.Types.ObjectId;
};
export const ChartOfAccounts: Model<ChartOfAccountsDoc> = model<ChartOfAccountsDoc>(
  'ChartOfAccounts',
  CoaSchema,
);
