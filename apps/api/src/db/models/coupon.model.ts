import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `coupons` — implements the PRD §3.2 coupon engine (percentage, flat, free-ship, BOGO)
 * with customer-segment targeting + scheduled activation windows.
 */
const CouponSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: String,
    description: String,
    type: {
      type: String,
      enum: ['percentage', 'flat', 'free_ship', 'bogo'],
      required: true,
    },
    /** Value semantics depend on `type`: percent (1-100), currency-minor-units (flat), or 0/null. */
    value: { type: Number, required: true },
    minSubtotal: Number,
    maxDiscount: Number,
    /** Per-customer redemption cap. `null` = unlimited. */
    perUserLimit: { type: Number, default: 1 },
    /** Global usage cap. */
    usageLimit: Number,
    usageCount: { type: Number, default: 0 },
    /** Eligibility — empty arrays mean no restriction. */
    productIds: { type: [Schema.Types.ObjectId], default: [] },
    categoryIds: { type: [Schema.Types.ObjectId], default: [] },
    segments: { type: [String], default: [] }, // e.g. ['vip', 'first_time']
    startsAt: Date,
    endsAt: Date,
    status: { type: String, enum: ['active', 'paused', 'expired'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'coupons' },
);

CouponSchema.index({ tenantId: 1, code: 1 }, { unique: true });
CouponSchema.index({ tenantId: 1, status: 1, endsAt: 1 });

export type CouponDoc = InferSchemaType<typeof CouponSchema> & { _id: Schema.Types.ObjectId };
export const Coupon: Model<CouponDoc> = model<CouponDoc>('Coupon', CouponSchema);
