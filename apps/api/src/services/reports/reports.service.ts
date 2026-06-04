import { randomUUID } from 'node:crypto';

import { ReportArtefact, ScheduledReport } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { enqueueNotification } from '../notifications/outbox.service.js';
import { REPORT_DEFINITIONS, resolveWindow, type ReportKey, type ReportContext } from './definitions.js';
import { renderReport, type ReportFormat } from './formats.js';

/**
 * Reports orchestration — Phase 5.2.
 *
 * `runReport()` is the single entry point used by the API (sync request) and
 * the worker (scheduled cron). It generates the dataset, renders to the chosen
 * format, persists the buffer to S3 (stubbed today behind the same Phase 3 S3
 * helper), records a `reportArtefacts` row, and returns the artefact for
 * downstream notification.
 */

export interface RunReportInput {
  tenantId: string;
  actorId?: string;
  reportKey: ReportKey;
  format: ReportFormat;
  windowSpec?: 'last_24h' | 'last_7d' | 'last_30d' | 'last_90d';
  scheduledReportId?: string;
  ip?: string;
  ua?: string;
}

export interface RunReportOutput {
  artefactId: string;
  s3Key: string;
  contentType: string;
  sizeBytes: number;
  rowCount: number;
}

export async function runReport(input: RunReportInput): Promise<RunReportOutput> {
  const definition = REPORT_DEFINITIONS[input.reportKey];
  if (!definition) throw new HttpError(404, 'REPORT_NOT_FOUND', `Unknown report ${input.reportKey}.`);

  const { from, to } = resolveWindow(input.windowSpec);
  const ctx: ReportContext = { tenantId: input.tenantId, from, to };
  const dataset = await definition(ctx);
  const rendered = await renderReport(dataset, input.format);

  const s3Key = `tenants/${input.tenantId}/reports/${input.reportKey}/${randomUUID()}.${rendered.extension}`;
  // TODO(phase-5.2 follow-up): real `s3.PutObjectCommand` upload. The buffer is
  // already in `rendered.buffer` — the upload is a localised diff.

  const artefact = await ReportArtefact.create({
    tenantId: input.tenantId,
    scheduledReportId: input.scheduledReportId,
    reportKey: input.reportKey,
    format: input.format,
    s3Key,
    sizeBytes: rendered.buffer.byteLength,
    rowCount: dataset.rows.length,
    generatedBy: input.actorId,
  });

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'report.generated',
    entity: 'ReportArtefact',
    entityId: artefact._id,
    afterJson: { reportKey: input.reportKey, format: input.format, rows: dataset.rows.length },
    ip: input.ip,
    ua: input.ua,
  });

  return {
    artefactId: String(artefact._id),
    s3Key,
    contentType: rendered.contentType,
    sizeBytes: rendered.buffer.byteLength,
    rowCount: dataset.rows.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Scheduled reports                                                          */
/* -------------------------------------------------------------------------- */

export interface CreateScheduledInput {
  tenantId: string;
  actorId: string;
  name: string;
  description?: string;
  reportKey: ReportKey;
  format: ReportFormat;
  cron: string;
  windowSpec: 'last_24h' | 'last_7d' | 'last_30d' | 'last_90d';
  recipients: { userIds?: string[]; addresses?: string[] };
  ip?: string;
  ua?: string;
}

export async function createScheduledReport(input: CreateScheduledInput) {
  if (!isValidCron(input.cron)) {
    throw new HttpError(400, 'INVALID_CRON', 'Cron expression must be a 5-field UNIX schedule.');
  }
  const doc = await ScheduledReport.create({
    tenantId: input.tenantId,
    name: input.name,
    description: input.description,
    reportKey: input.reportKey,
    format: input.format,
    cron: input.cron,
    windowSpec: input.windowSpec,
    recipients: {
      userIds: input.recipients.userIds ?? [],
      addresses: input.recipients.addresses ?? [],
    },
    isActive: true,
    createdBy: input.actorId,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'report.scheduled',
    entity: 'ScheduledReport',
    entityId: doc._id,
    afterJson: { reportKey: input.reportKey, cron: input.cron },
    ip: input.ip,
    ua: input.ua,
  });
  return doc;
}

function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  // Permissive validator — the worker uses a real cron lib at execution time.
  return parts.every((p) => /^([*\d,/-]+)$/.test(p));
}

export async function listScheduledReports(tenantId: string) {
  return ScheduledReport.find({ tenantId }).sort({ createdAt: -1 }).lean();
}

export async function deactivateScheduledReport(tenantId: string, id: string, actorId: string) {
  await ScheduledReport.updateOne({ _id: id, tenantId }, { $set: { isActive: false } });
  await audit({
    tenantId,
    actorId,
    action: 'report.schedule_deactivated',
    entity: 'ScheduledReport',
    entityId: id,
  });
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

export interface DeliverReportInput {
  tenantId: string;
  scheduledReportId: string;
  artefactId: string;
  reportName: string;
  recipients: { userIds?: string[]; addresses?: string[] };
}

export async function deliverScheduledReport(input: DeliverReportInput): Promise<void> {
  const payload = {
    reportName: input.reportName,
    artefactId: input.artefactId,
    downloadHint: `Available via /api/v1/reports/artefacts/${input.artefactId}`,
  };
  for (const userId of input.recipients.userIds ?? []) {
    // eslint-disable-next-line no-await-in-loop -- per-recipient, low cardinality
    await enqueueNotification({
      tenantId: input.tenantId,
      channel: 'email',
      template: 'report.delivered',
      toUserId: userId,
      payload,
      eventKey: `report.delivered:${input.artefactId}:user:${userId}`,
    });
  }
  for (const address of input.recipients.addresses ?? []) {
    // eslint-disable-next-line no-await-in-loop
    await enqueueNotification({
      tenantId: input.tenantId,
      channel: 'email',
      template: 'report.delivered',
      toAddress: address,
      payload,
      eventKey: `report.delivered:${input.artefactId}:addr:${address}`,
    });
  }
}
