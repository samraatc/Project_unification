import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `checkoutSessions` — Database.md §5.2. 5-step state machine. */
const CheckoutSessionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    cartId: { type: Schema.Types.ObjectId, ref: 'Cart', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestToken: String,
    guestEmail: String,
    step: {
      type: String,
      enum: ['address', 'delivery', 'review', 'payment', 'confirmation'],
      default: 'address',
    },
    addressSnapshot: Schema.Types.Mixed,
    shippingMethod: String,
    paymentMethod: { type: String, enum: ['esewa', 'khalti', 'stripe', 'paypal', 'cod'] },
    paymentRef: String,
    paymentClientSecret: String,
    status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active', index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'checkoutSessions' },
);

CheckoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
CheckoutSessionSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });

export type CheckoutSessionDoc = InferSchemaType<typeof CheckoutSessionSchema> & {
  _id: Schema.Types.ObjectId;
};
export const CheckoutSession: Model<CheckoutSessionDoc> = model<CheckoutSessionDoc>(
  'CheckoutSession',
  CheckoutSessionSchema,
);
