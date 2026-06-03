import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * One-time passcode storage. PRD/FR-001: 6-digit, 10-minute validity, single-use,
 * rate-limited (1/min, 5/hr per identifier). The code itself is stored hashed.
 */
const OtpSchema = new Schema(
  {
    purpose: {
      type: String,
      enum: ['email_verify', 'phone_verify', 'password_reset', 'login_step_up'],
      required: true,
      index: true,
    },
    channel: { type: String, enum: ['email', 'sms'], required: true },
    identifier: { type: String, required: true, index: true }, // email or E.164 phone
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
    ip: String,
    ua: String,
  },
  { timestamps: true, collection: 'otps' },
);

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpSchema.index({ purpose: 1, identifier: 1, createdAt: -1 });

export type OtpDoc = InferSchemaType<typeof OtpSchema> & { _id: Schema.Types.ObjectId };
export const Otp: Model<OtpDoc> = model<OtpDoc>('Otp', OtpSchema);
