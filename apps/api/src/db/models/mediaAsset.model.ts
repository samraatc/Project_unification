import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `mediaAssets` — Database.md §7.4. S3-backed media library with tagging. */
const MediaAssetSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    key: { type: String, required: true, unique: true, index: true },
    bucket: String,
    mime: String,
    sizeBytes: Number,
    width: Number,
    height: Number,
    durationMs: Number,
    tags: { type: [String], default: [], index: true },
    altText: String,
    checksumSha256: String,
    usedIn: [
      {
        entity: String,
        entityId: Schema.Types.ObjectId,
      },
    ],
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'mediaAssets' },
);

MediaAssetSchema.index({ tenantId: 1, tags: 1, uploadedAt: -1 });

export type MediaAssetDoc = InferSchemaType<typeof MediaAssetSchema> & {
  _id: Schema.Types.ObjectId;
};
export const MediaAsset: Model<MediaAssetDoc> = model<MediaAssetDoc>('MediaAsset', MediaAssetSchema);
