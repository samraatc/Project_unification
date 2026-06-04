import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** Daily FX snapshot for multi-currency accounting (Sprint 6.3). */
const FxRateSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    base: { type: String, required: true }, // reporting currency
    quote: { type: String, required: true }, // foreign currency
    /** Rate stored as integer ×10_000 — 1 USD = 133_4500 means 1 USD = 133.45 NPR. */
    rateBp: { type: Number, required: true },
    asOf: { type: Date, required: true, index: true },
    source: { type: String, default: 'manual' },
  },
  { timestamps: true, collection: 'fxRates' },
);

FxRateSchema.index({ tenantId: 1, base: 1, quote: 1, asOf: -1 });

export type FxRateDoc = InferSchemaType<typeof FxRateSchema> & { _id: Schema.Types.ObjectId };
export const FxRate: Model<FxRateDoc> = model<FxRateDoc>('FxRate', FxRateSchema);
