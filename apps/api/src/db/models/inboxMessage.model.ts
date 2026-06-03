import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `inboxMessages` — Database.md §7.3. Unified inbox for comments, DMs, mentions. */
const InboxMessageSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    socialAccountId: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true, index: true },
    platform: { type: String, enum: ['facebook', 'instagram', 'tiktok'], required: true, index: true },
    threadId: { type: String, index: true },
    externalMessageId: { type: String, required: true },
    kind: { type: String, enum: ['comment', 'dm', 'mention'], required: true },
    authorHandle: String,
    authorAvatarUrl: String,
    body: String,
    mediaUrls: { type: [String], default: [] },
    referencesPostId: { type: Schema.Types.ObjectId, ref: 'Post' },
    direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    status: {
      type: String,
      enum: ['new', 'open', 'responded', 'closed'],
      default: 'new',
      index: true,
    },
    receivedAt: { type: Date, default: Date.now, index: true },
    respondedAt: Date,
    slaDueAt: Date,
    slaBreachedAt: Date,
  },
  { timestamps: true, collection: 'inboxMessages' },
);

InboxMessageSchema.index({ tenantId: 1, platform: 1, externalMessageId: 1 }, { unique: true });
InboxMessageSchema.index({ tenantId: 1, status: 1, receivedAt: -1 });
InboxMessageSchema.index({ tenantId: 1, assignedTo: 1, status: 1 });

export type InboxMessageDoc = InferSchemaType<typeof InboxMessageSchema> & {
  _id: Schema.Types.ObjectId;
};
export const InboxMessage: Model<InboxMessageDoc> = model<InboxMessageDoc>(
  'InboxMessage',
  InboxMessageSchema,
);
