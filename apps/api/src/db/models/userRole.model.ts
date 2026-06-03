import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `userRoles` — Database.md §3.3. Many-to-many join with optional row-level scope. */
const UserRoleSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    scope: { type: Schema.Types.Mixed, default: {} },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
  },
  { collection: 'userRoles' },
);

UserRoleSchema.index({ tenantId: 1, userId: 1 });
UserRoleSchema.index({ tenantId: 1, userId: 1, roleId: 1 }, { unique: true });

export type UserRoleDoc = InferSchemaType<typeof UserRoleSchema> & { _id: Schema.Types.ObjectId };
export const UserRole: Model<UserRoleDoc> = model<UserRoleDoc>('UserRole', UserRoleSchema);
