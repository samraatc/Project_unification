import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `subscriptions` — Database.md §8.1, PRD §3.7.
 *
 * Single active row per tenant. `entitlements` is the expanded feature-code set
 * that `requireEntitlement(code)` checks against. Status flow:
 *   trial → active → past_due → grace → cancelled/expired
 * Reactivation moves back to `active`; the dunning worker maintains the edge
 * transitions.
 */
const SubscriptionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true, unique: true },
    plan: {
      type: String,
      enum: ['trial', 'monthly', 'yearly', 'lifetime', 'enterprise'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'cancelled', 'expired', 'grace', 'trial'],
      default: 'trial',
      index: true,
    },
    cycle: {
      type: String,
      enum: ['none', 'monthly', 'yearly', 'one_off'],
      default: 'none',
    },
    seats: { type: Number, default: 1 },
    currency: { type: String, default: 'USD' },
    amountMinor: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    currentPeriodEnd: Date,
    expiresAt: Date,
    cancelledAt: Date,
    /** Provider state: which provider owns this subscription + their ref. */
    gateway: {
      provider: { type: String, enum: ['stripe', 'esewa', 'khalti'] },
      customerRef: String,
      subscriptionRef: String,
      paymentMethodRef: String,
    },
    /** Expanded feature codes the tenant currently has access to. */
    entitlements: { type: [String], default: [] },
    /** Dunning history — every retry attempt + downgrade. */
    history: [
      {
        event: String,
        at: { type: Date, default: Date.now },
        payload: Schema.Types.Mixed,
      },
    ],
    /** Dunning state tracking. */
    dunning: {
      attempts: { type: Number, default: 0 },
      lastAttemptAt: Date,
      nextAttemptAt: Date,
    },
  },
  { timestamps: true, collection: 'subscriptions' },
);

SubscriptionSchema.index({ status: 1, 'dunning.nextAttemptAt': 1 });

export type SubscriptionDoc = InferSchemaType<typeof SubscriptionSchema> & {
  _id: Schema.Types.ObjectId;
};
export const Subscription: Model<SubscriptionDoc> = model<SubscriptionDoc>(
  'Subscription',
  SubscriptionSchema,
);
