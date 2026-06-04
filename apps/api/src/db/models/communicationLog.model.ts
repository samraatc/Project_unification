import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `communicationLog` — every inbound/outbound touch with a customer
 * (email, SMS, push, manual note). Surfaces on the CRM Lite customer profile.
 */
const CommunicationLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    channel: {
      type: String,
      enum: ['email', 'sms', 'push', 'phone', 'note'],
      required: true,
    },
    subject: String,
    body: String,
    relatedEntity: String,
    relatedEntityId: { type: Schema.Types.ObjectId },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'communicationLog' },
);

CommunicationLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

export type CommunicationLogDoc = InferSchemaType<typeof CommunicationLogSchema> & {
  _id: Schema.Types.ObjectId;
};
export const CommunicationLog: Model<CommunicationLogDoc> = model<CommunicationLogDoc>(
  'CommunicationLog',
  CommunicationLogSchema,
);
