import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `roles` — Database.md §3.2. Permission codes are domain.action lowercase. */
const RoleSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: String,
    isSystem: { type: Boolean, default: false },
    permissions: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'roles' },
);

RoleSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export type RoleDoc = InferSchemaType<typeof RoleSchema> & { _id: Schema.Types.ObjectId };
export const Role: Model<RoleDoc> = model<RoleDoc>('Role', RoleSchema);
