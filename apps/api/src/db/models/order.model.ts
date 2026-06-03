import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `orders` — Database.md §6.1.
 *
 * Phase 3 ships the document + state-machine guard at the service layer; the
 * full courier/return/refund lifecycle lands in Phase 4. Status transitions:
 * pending → confirmed → processing → shipped → delivered, with `returned` /
 * `refunded` / `cancelled` as side branches.
 */
const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
  },
  { _id: true },
);

const OrderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    number: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestEmail: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    items: { type: [OrderItemSchema], default: [] },
    totals: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },
    currency: { type: String, default: 'USD' },
    couponCode: String,
    payment: {
      method: { type: String, enum: ['esewa', 'khalti', 'stripe', 'paypal', 'cod'] },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      gatewayRef: String,
      paidAt: Date,
    },
    shipping: {
      address: Schema.Types.Mixed,
      method: String,
      courier: String,
      trackingNumber: String,
      shippedAt: Date,
      deliveredAt: Date,
      scanEvents: [{ status: String, location: String, ts: Date }],
    },
    notes: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        body: String,
        internal: { type: Boolean, default: false },
        ts: { type: Date, default: Date.now },
      },
    ],
    statusHistory: [
      {
        from: String,
        to: String,
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: String,
        ts: { type: Date, default: Date.now },
      },
    ],
    invoicePdfKey: String,
  },
  { timestamps: true, collection: 'orders' },
);

OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, 'payment.status': 1, createdAt: -1 });
OrderSchema.index({ 'shipping.trackingNumber': 1 });

export type OrderDoc = InferSchemaType<typeof OrderSchema> & { _id: Schema.Types.ObjectId };
export const Order: Model<OrderDoc> = model<OrderDoc>('Order', OrderSchema);
