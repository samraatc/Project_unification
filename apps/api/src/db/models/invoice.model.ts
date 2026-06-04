import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `invoices` — Database.md §8.5. PDF + Nepal IRD e-invoice JSON live in S3. */
const InvoiceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    number: { type: String, required: true, unique: true },
    issuedAt: { type: Date, default: Date.now },
    dueAt: Date,
    currency: { type: String, default: 'USD' },
    subTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, required: true },
    lines: [
      {
        sku: String,
        description: String,
        qty: Number,
        unitPrice: Number,
        subtotal: Number,
        taxRateBp: Number,
        taxAmount: Number,
      },
    ],
    pdfKey: String,
    /** Nepal IRD canonical JSON (PRD/FR-014). Encrypted in S3 with KMS. */
    eInvoiceJsonKey: String,
    eInvoiceHash: String,
    status: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'void'],
      default: 'issued',
      index: true,
    },
  },
  { timestamps: true, collection: 'invoices' },
);

InvoiceSchema.index({ tenantId: 1, issuedAt: -1 });

export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema> & { _id: Schema.Types.ObjectId };
export const Invoice: Model<InvoiceDoc> = model<InvoiceDoc>('Invoice', InvoiceSchema);
