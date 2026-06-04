import { Router } from 'express';
import { z } from 'zod';

import { Order, Refund, Return } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  addOrderNote,
  issueRefund,
  requestReturn,
  transitionStatus,
} from '../../services/orders/orders.service.js';
import { assignCourier } from '../../services/couriers/couriers.service.js';

export const ordersRouter: Router = Router();

const ListQuery = z.object({
  status: z
    .enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'refunded', 'cancelled'])
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

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
      statusHistory: order.statusHistory,
      shipping: order.shipping,
      items: order.items.map((it) => ({ sku: it.sku, name: it.name, qty: it.qty })),
      totals: order.totals,
    });
  } catch (err) {
    next(err);
  }
});

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

/* -------------------------------------------------------------------------- */
/* Transitions, notes, courier                                                */
/* -------------------------------------------------------------------------- */

const TransitionBody = z.object({
  to: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled']),
  reason: z.string().max(1000).optional(),
  courierCode: z.enum(['pathao', 'aramex']).optional(),
  trackingNumber: z.string().max(120).optional(),
});

ordersRouter.post(
  '/:id/transitions',
  requireAuth,
  requirePermission('orders.update'),
  validate(TransitionBody),
  async (req, res, next) => {
    try {
      const order = await transitionStatus({
        orderId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        to: req.body.to,
        reason: req.body.reason,
        courierCode: req.body.courierCode,
        trackingNumber: req.body.trackingNumber,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

ordersRouter.post(
  '/:id/cancel',
  requireAuth,
  async (req, res, next) => {
    try {
      const order = await Order.findOne({ tenantId: req.user!.tenantId, _id: req.params.id }).select('userId status');
      if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      if (String(order.userId) !== req.user!.sub) {
        // Admins use /transitions to cancel.
        if (!req.user!.perms.includes('orders.update') && !req.user!.perms.includes('*')) {
          throw new HttpError(403, 'FORBIDDEN', 'Cannot cancel this order.');
        }
      }
      if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
        throw new HttpError(409, 'NOT_CANCELLABLE', 'Order can no longer be cancelled.');
      }
      const updated = await transitionStatus({
        orderId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        to: 'cancelled',
        reason: 'Customer-requested cancel',
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

const NoteBody = z.object({ body: z.string().min(1).max(4000), internal: z.boolean().default(false) });

ordersRouter.post(
  '/:id/notes',
  requireAuth,
  requirePermission('orders.update'),
  validate(NoteBody),
  async (req, res, next) => {
    try {
      const order = await addOrderNote({
        orderId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        body: req.body.body,
        internal: req.body.internal,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  },
);

const AssignCourierBody = z.object({
  courierCode: z.enum(['pathao', 'aramex']),
  trackingNumber: z.string().min(1).max(120),
});

ordersRouter.post(
  '/:id/courier',
  requireAuth,
  requirePermission('orders.update'),
  validate(AssignCourierBody),
  async (req, res, next) => {
    try {
      const order = await assignCourier({
        orderId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        courierCode: req.body.courierCode,
        trackingNumber: req.body.trackingNumber,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Returns + Refunds                                                          */
/* -------------------------------------------------------------------------- */

const ReturnBody = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        qty: z.number().int().positive(),
        reason: z.string().min(1).max(500),
      }),
    )
    .min(1),
  photos: z.array(z.string().url()).max(8).optional(),
});

ordersRouter.post('/:id/returns', requireAuth, validate(ReturnBody), async (req, res, next) => {
  try {
    const ret = await requestReturn({
      orderId: req.params.id,
      tenantId: req.user!.tenantId,
      userId: req.user!.sub,
      items: req.body.items,
      photos: req.body.photos,
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    res.status(201).json(ret);
  } catch (err) {
    next(err);
  }
});

ordersRouter.get('/:id/returns', requireAuth, requirePermission('orders.read'), async (req, res, next) => {
  try {
    const rows = await Return.find({ tenantId: req.user!.tenantId, orderId: req.params.id }).lean();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const RefundBody = z.object({
  amount: z.number().int().positive(),
  returnId: z.string().optional(),
});

ordersRouter.post(
  '/:id/refunds',
  requireAuth,
  requirePermission('orders.refund'),
  validate(RefundBody),
  async (req, res, next) => {
    try {
      const refund = await issueRefund({
        orderId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        amount: req.body.amount,
        returnId: req.body.returnId,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(refund);
    } catch (err) {
      next(err);
    }
  },
);

ordersRouter.get(
  '/:id/refunds',
  requireAuth,
  requirePermission('orders.read'),
  async (req, res, next) => {
    try {
      const rows = await Refund.find({ tenantId: req.user!.tenantId, orderId: req.params.id }).lean();
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);
