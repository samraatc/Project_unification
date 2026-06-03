import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `carts` — Database.md §5.1. One document per user OR per guest session token.
 * Guest carts are merged on login by the cart.service.
 */
const CartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    snapshotName: String,
    snapshotImage: String,
  },
  { _id: true },
);

const CartSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    guestToken: { type: String, index: true, sparse: true },
    items: { type: [CartItemSchema], default: [] },
    coupon: {
      code: String,
      type: String,
      value: Number,
      validatedAt: Date,
    },
    totals: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true, collection: 'carts' },
);

CartSchema.index({ tenantId: 1, userId: 1 }, { unique: true, sparse: true });
CartSchema.index({ tenantId: 1, guestToken: 1 }, { unique: true, sparse: true });

export type CartDoc = InferSchemaType<typeof CartSchema> & { _id: Schema.Types.ObjectId };
export const Cart: Model<CartDoc> = model<CartDoc>('Cart', CartSchema);
