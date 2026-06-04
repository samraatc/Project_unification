import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `refunds` — Database.md §6.3. */
const RefundSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    returnId: { type: Schema.Types.ObjectId, ref: 'Return' },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    gateway: { type: String, enum: ['stripe', 'esewa', 'khalti', 'paypal', 'cod'], required: true },
    gatewayRef: String,
    providerRefundId: String,
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending', index: true },
    processedAt: Date,
    error: String,
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'refunds' },
);

export type RefundDoc = InferSchemaType<typeof RefundSchema> & { _id: Schema.Types.ObjectId };
export const Refund: Model<RefundDoc> = model<RefundDoc>('Refund', RefundSchema);
