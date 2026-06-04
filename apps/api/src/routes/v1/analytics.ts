import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  getCRMAnalytics,
  getInventoryAnalytics,
  getOverview,
  getReviewAnalytics,
  getSalesAnalytics,
} from '../../services/analytics/analytics.service.js';

export const analyticsRouter: Router = Router();

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function parseRange(q: z.infer<typeof RangeQuery>) {
  return {
    from: q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000),
    to: q.to ? new Date(q.to) : new Date(),
  };
}

analyticsRouter.get(
  '/overview',
  requireAuth,
  requirePermission('orders.read'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      const range = parseRange(req.query as unknown as z.infer<typeof RangeQuery>);
      res.json(await getOverview(req.user!.tenantId, range));
    } catch (err) {
      next(err);
    }
  },
);

analyticsRouter.get(
  '/sales',
  requireAuth,
  requirePermission('orders.read'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      const range = parseRange(req.query as unknown as z.infer<typeof RangeQuery>);
      res.json(await getSalesAnalytics(req.user!.tenantId, range));
    } catch (err) {
      next(err);
    }
  },
);

analyticsRouter.get(
  '/inventory',
  requireAuth,
  requirePermission('inventory.read'),
  async (req, res, next) => {
    try {
      res.json(await getInventoryAnalytics(req.user!.tenantId));
    } catch (err) {
      next(err);
    }
  },
);

analyticsRouter.get(
  '/customers',
  requireAuth,
  requirePermission('users.read'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      const range = parseRange(req.query as unknown as z.infer<typeof RangeQuery>);
      res.json(await getCRMAnalytics(req.user!.tenantId, range));
    } catch (err) {
      next(err);
    }
  },
);

analyticsRouter.get(
  '/reviews',
  requireAuth,
  requirePermission('products.read'),
  async (req, res, next) => {
    try {
      res.json(await getReviewAnalytics(req.user!.tenantId));
    } catch (err) {
      next(err);
    }
  },
);
