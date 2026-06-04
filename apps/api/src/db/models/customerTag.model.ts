import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `customerTags` — CRM Lite tagging. Each tag is a label-only descriptor used
 * by segments; the segment evaluator filters customers by tag presence.
 */
const CustomerTagSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tag: { type: String, required: true, lowercase: true, trim: true, maxlength: 40 },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'customerTags' },
);

CustomerTagSchema.index({ tenantId: 1, userId: 1, tag: 1 }, { unique: true });
CustomerTagSchema.index({ tenantId: 1, tag: 1 });

export type CustomerTagDoc = InferSchemaType<typeof CustomerTagSchema> & {
  _id: Schema.Types.ObjectId;
};
export const CustomerTag: Model<CustomerTagDoc> = model<CustomerTagDoc>(
  'CustomerTag',
  CustomerTagSchema,
);
