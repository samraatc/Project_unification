import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `socialAccounts` — Database.md §7.1.
 *
 * OAuth tokens are stored as ciphertext via the envelope encryption service
 * (KMS-wrapped data key, per Security-Requirements §4.3). `select: false` keeps
 * them off accidental responses.
 */
const SocialAccountSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    platform: { type: String, enum: ['facebook', 'instagram', 'tiktok'], required: true, index: true },
    externalAccountId: { type: String, required: true },
    name: String,
    handle: String,
    avatarUrl: String,
    pageId: String, // Facebook page or Instagram business account id
    oauth: {
      accessTokenCipher: { type: String, select: false },
      refreshTokenCipher: { type: String, select: false },
      expiresAt: Date,
      scopes: { type: [String], default: [] },
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'expired', 'error'],
      default: 'connected',
      index: true,
    },
    lastError: String,
    connectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    connectedAt: { type: Date, default: Date.now },
    disconnectedAt: Date,
  },
  { timestamps: true, collection: 'socialAccounts' },
);

SocialAccountSchema.index(
  { tenantId: 1, platform: 1, externalAccountId: 1 },
  { unique: true },
);
SocialAccountSchema.index({ tenantId: 1, status: 1 });

export type SocialAccountDoc = InferSchemaType<typeof SocialAccountSchema> & {
  _id: Schema.Types.ObjectId;
};
export const SocialAccount: Model<SocialAccountDoc> = model<SocialAccountDoc>(
  'SocialAccount',
  SocialAccountSchema,
);
