import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `products` — Database.md §4.1.
 *
 * Variants are embedded for read-locality (PDP loads the product + every variant
 * in one round trip). The `slug` + `sku` are unique tenant-wide. Atlas Search
 * index is declared in `infra/atlas-search-indexes/products.json` and applied
 * out-of-band; the application treats it as already present.
 */

const VariantSchema = new Schema(
  {
    sku: { type: String, required: true },
    options: { type: Schema.Types.Mixed, default: {} }, // { size: 'M', colour: 'Red' }
    price: { type: Number, required: true },
    salePrice: Number,
    currency: { type: String, default: 'USD' },
    barcode: String,
    images: [{ url: String, alt: String, isPrimary: Boolean, order: Number }],
    weightGrams: Number,
    dimensionsCm: { l: Number, w: Number, h: Number },
  },
  { _id: true },
);

const ProductImageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: String,
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: String,
    descriptionRich: String, // Tiptap JSON-string, sanitised on write
    brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    images: { type: [ProductImageSchema], default: [] },
    basePrice: { type: Number, required: true },
    salePrice: Number,
    currency: { type: String, default: 'USD' },
    taxClass: { type: String, enum: ['standard', 'reduced', 'zero', 'exempt'], default: 'standard' },
    attributes: { type: Schema.Types.Mixed, default: {} },
    variants: { type: [VariantSchema], default: [] },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
    seo: {
      metaTitle: String,
      metaDescription: String,
      ogImage: String,
    },
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'products' },
);

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, status: 1, categories: 1 });
ProductSchema.index({ tenantId: 1, status: 1, basePrice: 1 });
ProductSchema.index({ 'variants.sku': 1 });

export type ProductDoc = InferSchemaType<typeof ProductSchema> & { _id: Schema.Types.ObjectId };
export const Product: Model<ProductDoc> = model<ProductDoc>('Product', ProductSchema);
