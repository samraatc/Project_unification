import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `paymentEvents` (and webhook events more generally) — Database.md §9.3.
 *
 * Unique index on (provider, externalEventId) is the idempotency key — every
 * inbound webhook handler upserts here first and short-circuits if the row exists.
 * Used by Stripe / eSewa / Khalti / PayPal / Pathao / Aramex / Meta / TikTok.
 */
const PaymentEventSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ['stripe', 'esewa', 'khalti', 'paypal', 'pathao', 'aramex', 'meta', 'tiktok'],
      required: true,
      index: true,
    },
    externalEventId: { type: String, required: true },
    type: { type: String, required: true, index: true },
    payloadHash: String,
    payload: Schema.Types.Mixed,
    receivedAt: { type: Date, default: Date.now },
    processedAt: Date,
    error: String,
  },
  { collection: 'paymentEvents' },
);

PaymentEventSchema.index({ provider: 1, externalEventId: 1 }, { unique: true });

export type PaymentEventDoc = InferSchemaType<typeof PaymentEventSchema> & {
  _id: Schema.Types.ObjectId;
};
export const PaymentEvent: Model<PaymentEventDoc> = model<PaymentEventDoc>(
  'PaymentEvent',
  PaymentEventSchema,
);
