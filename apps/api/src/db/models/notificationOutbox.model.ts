import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `notificationOutbox` — Database.md §9.2.
 *
 * Domain events write here synchronously; the BullMQ worker drains and dispatches
 * via SendGrid / Twilio / Sparrow / FCM with delivery tracking. Per-channel opt-out
 * is checked at dispatch time (not write time) so a preference flip during the
 * delivery window still works.
 */
const NotificationOutboxSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    channel: { type: String, enum: ['email', 'sms', 'push'], required: true, index: true },
    template: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    toAddress: String, // raw email / E.164 phone for guests
    /** Use this to dedupe (e.g. `order_paid:<orderId>`). */
    eventKey: { type: String, index: true },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed', 'suppressed'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: String,
    sentAt: Date,
    suppressedReason: String,
  },
  { timestamps: true, collection: 'notificationOutbox' },
);

NotificationOutboxSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
NotificationOutboxSchema.index({ eventKey: 1 }, { unique: true, sparse: true });

export type NotificationOutboxDoc = InferSchemaType<typeof NotificationOutboxSchema> & {
  _id: Schema.Types.ObjectId;
};
export const NotificationOutbox: Model<NotificationOutboxDoc> = model<NotificationOutboxDoc>(
  'NotificationOutbox',
  NotificationOutboxSchema,
);
