import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `categories` — Database.md §4.2.
 *
 * Hierarchical via `parent` ref + materialised `path[]` for O(depth) lookups.
 * The path is recomputed by the catalogue service whenever a category moves.
 */
const CategorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    path: { type: [Schema.Types.ObjectId], default: [], index: true },
    depth: { type: Number, default: 0 },
    imageUrl: String,
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    seo: {
      metaTitle: String,
      metaDescription: String,
      ogImage: String,
    },
  },
  { timestamps: true, collection: 'categories' },
);

CategorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ tenantId: 1, parent: 1, order: 1 });

export type CategoryDoc = InferSchemaType<typeof CategorySchema> & { _id: Schema.Types.ObjectId };
export const Category: Model<CategoryDoc> = model<CategoryDoc>('Category', CategorySchema);
