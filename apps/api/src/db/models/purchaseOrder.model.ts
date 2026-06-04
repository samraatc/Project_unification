import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `purchaseOrders` — Database.md §4.6. */
const POItemSchema = new Schema(
  {
    sku: { type: String, required: true },
    qtyOrdered: { type: Number, required: true, min: 1 },
    qtyReceived: { type: Number, default: 0 },
    unitCost: { type: Number, required: true },
  },
  { _id: true },
);

const PurchaseOrderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    number: { type: String, required: true, unique: true },
    supplier: {
      name: { type: String, required: true },
      contact: String,
      address: String,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partial', 'received', 'cancelled'],
      default: 'draft',
      index: true,
    },
    items: { type: [POItemSchema], default: [] },
    expectedAt: Date,
    receivedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  },
  { timestamps: true, collection: 'purchaseOrders' },
);

PurchaseOrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type PurchaseOrderDoc = InferSchemaType<typeof PurchaseOrderSchema> & {
  _id: Schema.Types.ObjectId;
};
export const PurchaseOrder: Model<PurchaseOrderDoc> = model<PurchaseOrderDoc>(
  'PurchaseOrder',
  PurchaseOrderSchema,
);
