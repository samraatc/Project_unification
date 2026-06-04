import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * `scheduledReports` — admin-defined recurring reports.
 *
 * `cron` is a 5-field UNIX cron expression evaluated by the worker every minute;
 * `lastRunAt` + `lastRunStatus` give the admin an at-a-glance health view.
 */
const ScheduledReportSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true, required: true },
    name: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    /** Maps to a `ReportDefinition` registered in code. */
    reportKey: {
      type: String,
      enum: ['sales_summary', 'inventory_snapshot', 'customer_segments', 'orders_full'],
      required: true,
    },
    format: { type: String, enum: ['csv', 'xlsx', 'pdf'], default: 'csv' },
    cron: { type: String, required: true },
    /** Window-relative options the report consumer needs (e.g. "last_7d"). */
    windowSpec: { type: String, enum: ['last_24h', 'last_7d', 'last_30d', 'last_90d'], default: 'last_7d' },
    recipients: {
      userIds: { type: [Schema.Types.ObjectId], default: [] },
      addresses: { type: [String], default: [] },
    },
    isActive: { type: Boolean, default: true },
    lastRunAt: Date,
    lastRunStatus: { type: String, enum: ['ok', 'failed'], default: undefined },
    lastRunError: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'scheduledReports' },
);

ScheduledReportSchema.index({ tenantId: 1, isActive: 1 });

export type ScheduledReportDoc = InferSchemaType<typeof ScheduledReportSchema> & {
  _id: Schema.Types.ObjectId;
};
export const ScheduledReport: Model<ScheduledReportDoc> = model<ScheduledReportDoc>(
  'ScheduledReport',
  ScheduledReportSchema,
);
