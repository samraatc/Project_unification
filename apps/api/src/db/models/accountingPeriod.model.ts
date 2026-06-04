import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `periods` — Database.md §8.6. Locking blocks new journal entries inside the window. */
const AccountingPeriodSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    type: { type: String, enum: ['month', 'quarter', 'year'], required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed', 'locked'], default: 'open', index: true },
    closedAt: Date,
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lockedAt: Date,
    reopenedAt: Date,
    reopenedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'accountingPeriods' },
);

AccountingPeriodSchema.index({ tenantId: 1, startsAt: 1, type: 1 }, { unique: true });

export type AccountingPeriodDoc = InferSchemaType<typeof AccountingPeriodSchema> & {
  _id: Schema.Types.ObjectId;
};
export const AccountingPeriod: Model<AccountingPeriodDoc> = model<AccountingPeriodDoc>(
  'AccountingPeriod',
  AccountingPeriodSchema,
);
