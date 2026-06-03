import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `stockMovements` — Database.md §4.5. Append-only ledger of inventory deltas. */
const StockMovementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    sku: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['order_reserve', 'order_fulfil', 'return_restock', 'adjustment', 'po_receive', 'write_off'],
      required: true,
      index: true,
    },
    qtyChange: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    referenceType: String,
    referenceId: { type: Schema.Types.ObjectId },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: String,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, collection: 'stockMovements' },
);

StockMovementSchema.index({ tenantId: 1, sku: 1, createdAt: -1 });

export type StockMovementDoc = InferSchemaType<typeof StockMovementSchema> & {
  _id: Schema.Types.ObjectId;
};
export const StockMovement: Model<StockMovementDoc> = model<StockMovementDoc>(
  'StockMovement',
  StockMovementSchema,
);
