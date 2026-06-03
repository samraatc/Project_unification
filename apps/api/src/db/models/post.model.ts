import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `posts` — Database.md §7.2.
 *
 * One document = one composer entry. `targets[]` records the per-platform fan-out
 * with per-platform overrides + the resulting `externalPostId` once the publish
 * worker has succeeded for each target.
 */

const TargetSchema = new Schema(
  {
    socialAccountId: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
    platform: { type: String, enum: ['facebook', 'instagram', 'tiktok'], required: true },
    overrides: {
      caption: String,
      hashtags: [String],
      // Per-platform media subset (some platforms cap at 1, others at 10).
      mediaKeys: [String],
      firstComment: String,
    },
    externalPostId: String,
    publishedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'publishing', 'published', 'failed'],
      default: 'pending',
    },
    error: String,
    metrics: {
      impressions: Number,
      reach: Number,
      engagement: Number,
      clicks: Number,
      lastSyncedAt: Date,
    },
  },
  { _id: true },
);

const PostSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    content: { type: String, required: true },
    mediaKeys: { type: [String], default: [] },
    targets: { type: [TargetSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed'],
      default: 'draft',
      index: true,
    },
    scheduledAt: { type: Date, index: true },
    publishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvalRequestedAt: Date,
    approvedAt: Date,
    rejectedReason: String,
  },
  { timestamps: true, collection: 'posts' },
);

PostSchema.index({ tenantId: 1, status: 1, scheduledAt: 1 });
PostSchema.index({ tenantId: 1, createdBy: 1, createdAt: -1 });

export type PostDoc = InferSchemaType<typeof PostSchema> & { _id: Schema.Types.ObjectId };
export const Post: Model<PostDoc> = model<PostDoc>('Post', PostSchema);
