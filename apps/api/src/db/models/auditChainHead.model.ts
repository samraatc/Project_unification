import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `auditChainHeads` — per-tenant tamper-evident chain head (D-0018).
 *
 * The accounting worker maintains one row per tenant; every premium audit event
 * computes `sha256(prevHash + canonicalJson(entry))` and updates the head.
 * Verifying the chain replays the chain from genesis (`prevHash = ''`).
 */
const AuditChainHeadSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true, unique: true },
    headHash: { type: String, required: true, default: '' },
    headEntryId: { type: Schema.Types.ObjectId, ref: 'AuditLog' },
    chainLength: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'auditChainHeads' },
);

export type AuditChainHeadDoc = InferSchemaType<typeof AuditChainHeadSchema> & {
  _id: Schema.Types.ObjectId;
};
export const AuditChainHead: Model<AuditChainHeadDoc> = model<AuditChainHeadDoc>(
  'AuditChainHead',
  AuditChainHeadSchema,
);
