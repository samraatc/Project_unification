import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `inventory` — Database.md §4.4.
 *
 * One document per SKU. `available = onHand - reserved` is enforced by the
 * service layer's atomic `findOneAndUpdate` (the document property is for
 * read convenience). Low-stock alerts fire when `available <= threshold`.
 */
const InventorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    sku: { type: String, required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    variantId: { type: Schema.Types.ObjectId },
    onHand: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    threshold: { type: Number, default: 0 },
    warehouse: { type: String, default: 'default' },
    lastAdjustedAt: Date,
  },
  { timestamps: true, collection: 'inventory' },
);

InventorySchema.index({ tenantId: 1, sku: 1 }, { unique: true });
InventorySchema.index(
  { tenantId: 1, available: 1 },
  { partialFilterExpression: { available: { $lte: 0 } } },
);

export type InventoryDoc = InferSchemaType<typeof InventorySchema> & { _id: Schema.Types.ObjectId };
export const Inventory: Model<InventoryDoc> = model<InventoryDoc>('Inventory', InventorySchema);
