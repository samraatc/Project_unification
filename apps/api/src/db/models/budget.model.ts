import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `budgets` — Database.md §8.9. */
const BudgetSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    year: { type: Number, required: true },
    costCentre: { type: String, default: 'default' },
    accountId: { type: Schema.Types.ObjectId, ref: 'ChartOfAccounts', required: true },
    /** 12 monthly values in minor units. */
    monthly: {
      type: [Number],
      validate: [(arr: number[]) => arr.length === 12, 'Budget must have 12 months'],
      default: () => new Array(12).fill(0),
    },
    notes: String,
  },
  { timestamps: true, collection: 'budgets' },
);

BudgetSchema.index({ tenantId: 1, year: 1, costCentre: 1, accountId: 1 }, { unique: true });

export type BudgetDoc = InferSchemaType<typeof BudgetSchema> & { _id: Schema.Types.ObjectId };
export const Budget: Model<BudgetDoc> = model<BudgetDoc>('Budget', BudgetSchema);
