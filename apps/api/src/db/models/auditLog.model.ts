import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `auditLog` — Database.md §9.1, Security-Requirements §8.
 *
 * Append-only. `premium=true` entries are eligible for the tamper-evident chain
 * (SHA-256 of previous entry's hash) maintained by the accounting worker in Phase 6.
 * Stored on a dedicated cluster per Sprint 0 decision.
 */
const AuditLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    beforeJson: Schema.Types.Mixed,
    afterJson: Schema.Types.Mixed,
    ip: String,
    ua: String,
    requestId: String,
    premium: { type: Boolean, default: false, index: true },
    chainPrevHash: String,
    chainHash: String,
  },
  { timestamps: { createdAt: 'ts', updatedAt: false }, collection: 'auditLog' },
);

AuditLogSchema.index({ tenantId: 1, entity: 1, entityId: 1, ts: -1 });
AuditLogSchema.index({ tenantId: 1, actorId: 1, ts: -1 });

// Block deletes at the model level. Updates are forbidden by convention; the WORM
// mount enforces the same at the storage layer in Phase 6.
AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
  next(new Error('auditLog is append-only'));
});
AuditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function (next) {
  next(new Error('auditLog is append-only'));
});

export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema> & { _id: Schema.Types.ObjectId };
export const AuditLog: Model<AuditLogDoc> = model<AuditLogDoc>('AuditLog', AuditLogSchema);
