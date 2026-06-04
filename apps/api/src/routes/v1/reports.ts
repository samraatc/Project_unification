import { Router } from 'express';
import { z } from 'zod';

import { ReportArtefact, ScheduledReport } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createScheduledReport,
  deactivateScheduledReport,
  listScheduledReports,
  runReport,
} from '../../services/reports/reports.service.js';

export const reportsRouter: Router = Router();

const RunBody = z.object({
  reportKey: z.enum(['sales_summary', 'inventory_snapshot', 'customer_segments', 'orders_full']),
  format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  windowSpec: z.enum(['last_24h', 'last_7d', 'last_30d', 'last_90d']).default('last_7d'),
});

reportsRouter.post(
  '/run',
  requireAuth,
  requirePermission('orders.read'),
  validate(RunBody),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof RunBody>;
      const result = await runReport({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        reportKey: body.reportKey,
        format: body.format,
        windowSpec: body.windowSpec,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

const ScheduleBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  reportKey: z.enum(['sales_summary', 'inventory_snapshot', 'customer_segments', 'orders_full']),
  format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  cron: z.string().min(9).max(80),
  windowSpec: z.enum(['last_24h', 'last_7d', 'last_30d', 'last_90d']).default('last_7d'),
  recipients: z
    .object({
      userIds: z.array(z.string()).default([]),
      addresses: z.array(z.string().email()).default([]),
    })
    .refine((r) => (r.userIds.length + r.addresses.length) > 0, {
      message: 'Provide at least one recipient',
    }),
});

reportsRouter.post(
  '/schedules',
  requireAuth,
  requirePermission('orders.read'),
  validate(ScheduleBody),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof ScheduleBody>;
      const doc = await createScheduledReport({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...body,
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  '/schedules',
  requireAuth,
  requirePermission('orders.read'),
  async (req, res, next) => {
    try {
      const docs = await listScheduledReports(req.user!.tenantId);
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.delete(
  '/schedules/:id',
  requireAuth,
  requirePermission('orders.read'),
  async (req, res, next) => {
    try {
      await deactivateScheduledReport(req.user!.tenantId, req.params.id, req.user!.sub);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  '/artefacts',
  requireAuth,
  requirePermission('orders.read'),
  async (req, res, next) => {
    try {
      const docs = await ReportArtefact.find({ tenantId: req.user!.tenantId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  '/artefacts/:id',
  requireAuth,
  requirePermission('orders.read'),
  async (req, res, next) => {
    try {
      const doc = await ReportArtefact.findOne({ _id: req.params.id, tenantId: req.user!.tenantId }).lean();
      if (!doc) throw new HttpError(404, 'ARTEFACT_NOT_FOUND', 'Report artefact not found.');
      // Phase 5.2 follow-up: real S3 signed URL.
      res.json({ ...doc, downloadUrl: `stub://artefacts/${doc.s3Key}` });
    } catch (err) {
      next(err);
    }
  },
);

void ScheduledReport;
