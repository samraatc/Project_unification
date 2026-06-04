import { Router } from 'express';
import { z } from 'zod';

import { Inventory, StockMovement } from '../../db/models/index.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  adjustStock,
  listLowStock,
  setThreshold,
} from '../../services/inventory/inventory.service.js';
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  sendPurchaseOrder,
} from '../../services/inventory/purchaseOrder.service.js';

export const inventoryRouter: Router = Router();
export const purchaseOrdersRouter: Router = Router();
export const stockMovementsRouter: Router = Router();

inventoryRouter.get('/', requireAuth, requirePermission('inventory.read'), async (req, res, next) => {
  try {
    const docs = await Inventory.find({ tenantId: req.user!.tenantId }).sort({ available: 1 }).limit(200).lean();
    res.json({ data: docs });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get(
  '/low-stock',
  requireAuth,
  requirePermission('inventory.read'),
  async (req, res, next) => {
    try {
      const docs = await listLowStock(req.user!.tenantId);
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

const AdjustBody = z.object({
  sku: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().min(1).max(500),
  type: z.enum(['adjustment', 'write_off']).default('adjustment'),
});

inventoryRouter.post(
  '/adjust',
  requireAuth,
  requirePermission('inventory.adjust'),
  validate(AdjustBody),
  async (req, res, next) => {
    try {
      const doc = await adjustStock({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...req.body,
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

const ThresholdBody = z.object({ sku: z.string().min(1), threshold: z.number().int().nonnegative() });

inventoryRouter.patch(
  '/threshold',
  requireAuth,
  requirePermission('inventory.adjust'),
  validate(ThresholdBody),
  async (req, res, next) => {
    try {
      const doc = await setThreshold({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...req.body,
      });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */

stockMovementsRouter.get(
  '/',
  requireAuth,
  requirePermission('inventory.read'),
  async (req, res, next) => {
    try {
      const sku = String(req.query.sku ?? '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
      const filter: any = { tenantId: req.user!.tenantId };
      if (sku) filter.sku = sku;
      const docs = await StockMovement.find(filter).sort({ createdAt: -1 }).limit(200).lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */

const CreatePOBody = z.object({
  supplier: z.object({
    name: z.string().min(1).max(200),
    contact: z.string().max(200).optional(),
    address: z.string().max(500).optional(),
  }),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        qtyOrdered: z.number().int().positive(),
        unitCost: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  expectedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

purchaseOrdersRouter.get(
  '/',
  requireAuth,
  requirePermission('purchasing.read'),
  async (req, res, next) => {
    try {
      const { PurchaseOrder } = await import('../../db/models/index.js');
      const docs = await PurchaseOrder.find({ tenantId: req.user!.tenantId }).sort({ createdAt: -1 }).lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

purchaseOrdersRouter.post(
  '/',
  requireAuth,
  requirePermission('purchasing.create'),
  validate(CreatePOBody),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof CreatePOBody>;
      const po = await createPurchaseOrder({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...body,
        expectedAt: body.expectedAt ? new Date(body.expectedAt) : undefined,
      });
      res.status(201).json(po);
    } catch (err) {
      next(err);
    }
  },
);

purchaseOrdersRouter.post(
  '/:id/send',
  requireAuth,
  requirePermission('purchasing.update'),
  async (req, res, next) => {
    try {
      const po = await sendPurchaseOrder({
        poId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(po);
    } catch (err) {
      next(err);
    }
  },
);

const ReceiveBody = z.object({
  items: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).min(1),
});

purchaseOrdersRouter.post(
  '/:id/receive',
  requireAuth,
  requirePermission('purchasing.update'),
  validate(ReceiveBody),
  async (req, res, next) => {
    try {
      const po = await receivePurchaseOrder({
        poId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        items: req.body.items,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(po);
    } catch (err) {
      next(err);
    }
  },
);
