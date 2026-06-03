import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `users` collection — Database.md §3.1.
 *
 * Identity is keyed by `email` (unique sparse) and `phone` (unique sparse) so a user
 * can sign up with one and add the other later. `passwordHash` is bcrypt cost-12;
 * `twoFA.secret` and `oauth.{access,refresh}Token` are envelope-encrypted by the
 * service layer before the document is written (Security-Requirements §4.3).
 */

const AddressSchema = new Schema(
  {
    label: String,
    line1: String,
    line2: String,
    city: String,
    region: String,
    postalCode: String,
    country: String,
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const OAuthLinkSchema = new Schema(
  {
    provider: { type: String, enum: ['google', 'facebook'], required: true },
    providerUserId: { type: String, required: true },
    accessTokenCipher: { type: String, select: false },
    refreshTokenCipher: { type: String, select: false },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    email: { type: String, lowercase: true, trim: true, index: { unique: true, sparse: true } },
    phone: { type: String, trim: true, index: { unique: true, sparse: true } },
    passwordHash: { type: String, select: false },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'deleted'],
      default: 'pending',
      index: true,
    },
    emailVerifiedAt: Date,
    phoneVerifiedAt: Date,

    twoFA: {
      enabled: { type: Boolean, default: false },
      secretCipher: { type: String, select: false },
      backupCodesHash: { type: [String], select: false, default: [] },
      enrolledAt: Date,
    },

    profile: {
      firstName: String,
      lastName: String,
      avatarUrl: String,
      dob: Date,
      gender: String,
    },

    addresses: { type: [AddressSchema], default: [], validate: [(a: unknown[]) => a.length <= 5, 'Maximum 5 addresses'] },
    wallets: { eSewaId: String, khaltiId: String },

    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
      locale: { type: String, default: 'en' },
      currency: { type: String, default: 'USD' },
      marketingOptIn: { type: Boolean, default: false },
    },

    oauth: { type: [OAuthLinkSchema], default: [] },

    savedSearches: [{ q: String, filters: Schema.Types.Mixed, createdAt: Date }],
    wishlist: [{ productId: Schema.Types.ObjectId, variantId: Schema.Types.ObjectId, addedAt: Date }],

    // Account-lockout sliding window (Security-Requirements §2).
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },

    lastLoginAt: Date,

    // Soft-delete + anonymisation per Database.md §12.
    deletedAt: Date,
  },
  { timestamps: true, collection: 'users' },
);

UserSchema.index({ tenantId: 1, status: 1 });
UserSchema.index({ 'oauth.provider': 1, 'oauth.providerUserId': 1 });
UserSchema.index({ deletedAt: 1 }, { sparse: true });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Schema.Types.ObjectId };
export const User: Model<UserDoc> = model<UserDoc>('User', UserSchema);
