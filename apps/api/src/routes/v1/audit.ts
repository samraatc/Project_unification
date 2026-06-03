import { Router } from 'express';
import { z } from 'zod';

import { AuditLog } from '../../db/models/index.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const auditRouter: Router = Router();

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

auditRouter.get(
  '/',
  requireAuth,
  requirePermission('audit.read'),
  validate(ListQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof ListQuery>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
      const filter: any = { tenantId: req.user!.tenantId };
      if (q.entity) filter.entity = q.entity;
      if (q.entityId) filter.entityId = q.entityId;
      if (q.actorId) filter.actorId = q.actorId;
      if (q.action) filter.action = q.action;
      if (q.from || q.to) filter.ts = {};
      if (q.from) filter.ts.$gte = new Date(q.from);
      if (q.to) filter.ts.$lte = new Date(q.to);
      if (q.cursor) filter._id = { $lt: q.cursor };

      const docs = await AuditLog.find(filter)
        .sort({ _id: -1 })
        .limit(q.limit + 1)
        .lean();
      const hasMore = docs.length > q.limit;
      const items = hasMore ? docs.slice(0, q.limit) : docs;
      res.json({
        data: items,
        meta: { nextCursor: hasMore ? String(items[items.length - 1]?._id) : null },
      });
    } catch (err) {
      next(err);
    }
  },
);
