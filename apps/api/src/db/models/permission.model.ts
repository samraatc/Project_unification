import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `permissions` master list — Database.md §3.4. Seeded by `seedPermissions()`. */
const PermissionSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    domain: { type: String, required: true, index: true },
    description: String,
    isPremium: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'permissions' },
);

export type PermissionDoc = InferSchemaType<typeof PermissionSchema> & { _id: Schema.Types.ObjectId };
export const Permission: Model<PermissionDoc> = model<PermissionDoc>('Permission', PermissionSchema);
