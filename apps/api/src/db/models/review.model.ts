import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** Product reviews — only verified buyers may post (enforced at service layer). */
const ReviewSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 120 },
    body: { type: String, maxlength: 4000 },
    media: { type: [{ url: String, mime: String }], default: [] },
    helpfulVotes: { type: Number, default: 0 },
    status: { type: String, enum: ['published', 'pending', 'rejected'], default: 'published', index: true },
  },
  { timestamps: true, collection: 'reviews' },
);

ReviewSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
ReviewSchema.index({ tenantId: 1, userId: 1, productId: 1 }, { unique: true });

export type ReviewDoc = InferSchemaType<typeof ReviewSchema> & { _id: Schema.Types.ObjectId };
export const Review: Model<ReviewDoc> = model<ReviewDoc>('Review', ReviewSchema);
