import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `brands` — Database.md §4.3. */
const BrandSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    logoUrl: String,
    description: String,
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true, collection: 'brands' },
);

BrandSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

export type BrandDoc = InferSchemaType<typeof BrandSchema> & { _id: Schema.Types.ObjectId };
export const Brand: Model<BrandDoc> = model<BrandDoc>('Brand', BrandSchema);
