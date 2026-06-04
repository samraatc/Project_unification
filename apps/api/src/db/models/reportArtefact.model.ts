import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/** `reportArtefacts` — past report runs. The S3 key + signed URL is the deliverable. */
const ReportArtefactSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    scheduledReportId: { type: Schema.Types.ObjectId, ref: 'ScheduledReport' },
    reportKey: { type: String, required: true },
    format: { type: String, enum: ['csv', 'xlsx', 'pdf'], required: true },
    s3Key: { type: String, required: true },
    sizeBytes: Number,
    rowCount: Number,
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'reportArtefacts' },
);

ReportArtefactSchema.index({ tenantId: 1, createdAt: -1 });

export type ReportArtefactDoc = InferSchemaType<typeof ReportArtefactSchema> & {
  _id: Schema.Types.ObjectId;
};
export const ReportArtefact: Model<ReportArtefactDoc> = model<ReportArtefactDoc>(
  'ReportArtefact',
  ReportArtefactSchema,
);
