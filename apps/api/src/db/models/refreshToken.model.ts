import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `refreshTokens` — Database.md §3.5.
 *
 * `family` ties together rotation chains. Theft detection: if a previously-rotated
 * token is presented (a different token in the same family is already active), the
 * whole family is revoked (Security-Requirements §2).
 */
const RefreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    family: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    parentTokenHash: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    rotatedAt: Date,
    ip: String,
    ua: String,
  },
  { timestamps: true, collection: 'refreshTokens' },
);

// TTL purge — keeps the collection small.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof RefreshTokenSchema> & {
  _id: Schema.Types.ObjectId;
};
export const RefreshToken: Model<RefreshTokenDoc> = model<RefreshTokenDoc>(
  'RefreshToken',
  RefreshTokenSchema,
);
