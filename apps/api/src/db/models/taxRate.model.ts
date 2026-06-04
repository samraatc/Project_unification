import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `taxRates` — Database.md §8.4. */
const TaxRateSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    /** Rate as percent ×100 to keep it integer (e.g. 1300 = 13%). */
    rateBp: { type: Number, required: true },
    jurisdiction: { type: String, default: 'NP' },
    /** Maps to product `taxClass`. */
    appliesTo: { type: [String], default: [] },
    validFrom: { type: Date, default: Date.now },
    validTo: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'taxRates' },
);

TaxRateSchema.index({ tenantId: 1, code: 1, validFrom: -1 });

export type TaxRateDoc = InferSchemaType<typeof TaxRateSchema> & { _id: Schema.Types.ObjectId };
export const TaxRate: Model<TaxRateDoc> = model<TaxRateDoc>('TaxRate', TaxRateSchema);
