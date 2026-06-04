import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `returns` — Database.md §6.2. */
const ReturnSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    items: [
      {
        orderItemId: Schema.Types.ObjectId,
        sku: String,
        qty: Number,
        reason: String,
      },
    ],
    photos: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['requested', 'approved', 'rejected', 'completed'],
      default: 'requested',
      index: true,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    requestedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true, collection: 'returns' },
);

export type ReturnDoc = InferSchemaType<typeof ReturnSchema> & { _id: Schema.Types.ObjectId };
export const Return: Model<ReturnDoc> = model<ReturnDoc>('Return', ReturnSchema);
