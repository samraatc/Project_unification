import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `couriers` — Database.md §6.4.
 *
 * One row per provider × tenant. The `webhookSecret` is rotated via admin UI;
 * the courier-webhook service hashes the inbound payload with it for verification.
 */
const CourierSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    code: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    trackingUrlTemplate: String,
    /** Stored ciphertext; decrypted in-memory when the webhook fires. */
    webhookSecretCipher: { type: String, select: false },
    contactPhone: String,
    contactEmail: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'couriers' },
);

CourierSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export type CourierDoc = InferSchemaType<typeof CourierSchema> & { _id: Schema.Types.ObjectId };
export const Courier: Model<CourierDoc> = model<CourierDoc>('Courier', CourierSchema);
