import { Router } from 'express';
import { z } from 'zod';

import { Order } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const ordersRouter: Router = Router();

const ListQuery = z.object({
  status: z
    .enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'refunded', 'cancelled'])
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Customer-scoped list (My Orders). */
ordersRouter.get('/me', requireAuth, validate(ListQuery, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
    const filter: any = { tenantId: req.user!.tenantId, userId: req.user!.sub };
    if (q.status) filter.status = q.status;
    if (q.cursor) filter._id = { $lt: q.cursor };
    const docs = await Order.find(filter).sort({ _id: -1 }).limit(q.limit + 1).lean();
    const hasMore = docs.length > q.limit;
    const items = hasMore ? docs.slice(0, q.limit) : docs;
    res.json({
      data: items,
      meta: { nextCursor: hasMore ? String(items[items.length - 1]?._id) : null },
    });
  } catch (err) {
    next(err);
  }
});

/** Admin-scoped list. */
ordersRouter.get(
  '/',
  requireAuth,
  requirePermission('orders.read'),
  validate(ListQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof ListQuery>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
      const filter: any = { tenantId: req.user!.tenantId };
      if (q.status) filter.status = q.status;
      if (q.cursor) filter._id = { $lt: q.cursor };
      const docs = await Order.find(filter).sort({ _id: -1 }).limit(q.limit + 1).lean();
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

ordersRouter.get('/:number', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ tenantId: req.user!.tenantId, number: req.params.number }).lean();
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    const isOwner = String(order.userId) === req.user!.sub;
    const isAdmin = req.user!.perms.includes('orders.read') || req.user!.perms.includes('*');
    if (!isOwner && !isAdmin) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this order.');
    res.json(order);
  } catch (err) {
    next(err);
  }
});

/** Guest tracking — no auth, requires email match. */
ordersRouter.get('/track', async (req, res, next) => {
  try {
    const number = String(req.query.orderNumber ?? '');
    const identifier = String(req.query.identifier ?? '').toLowerCase();
    if (!number || !identifier) throw new HttpError(400, 'INVALID_INPUT', 'orderNumber and identifier required.');
    const order = await Order.findOne({ number }).lean();
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    const matches =
      (order.guestEmail && order.guestEmail.toLowerCase() === identifier) ||
      (order.shipping?.address && JSON.stringify(order.shipping.address).toLowerCase().includes(identifier));
    if (!matches) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    res.json({
      number: order.number,
      status: order.status,
      shipping: { courier: order.shipping?.courier, trackingNumber: order.shipping?.trackingNumber, events: order.shipping?.scanEvents },
      items: order.items.map((it) => ({ sku: it.sku, name: it.name, qty: it.qty })),
      totals: order.totals,
    });
  } catch (err) {
    next(err);
  }
});
