import { Router } from 'express';
import { z } from 'zod';

import { Courier } from '../../db/models/index.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  registerCourier,
  rotateWebhookSecret,
} from '../../services/couriers/couriers.service.js';
import { COURIER_CODES } from '../../services/couriers/providers/index.js';

export const couriersRouter: Router = Router();

couriersRouter.get(
  '/',
  requireAuth,
  requirePermission('orders.update'),
  async (req, res, next) => {
    try {
      const docs = await Courier.find({ tenantId: req.user!.tenantId }).select('code name trackingUrlTemplate isActive').lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

const RegisterBody = z.object({
  code: z.enum(['pathao', 'aramex']),
  name: z.string().min(1).max(120),
  webhookSecret: z.string().min(16).max(200),
  trackingUrlTemplate: z.string().url().optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().optional(),
});

couriersRouter.post(
  '/',
  requireAuth,
  requirePermission('orders.update'),
  validate(RegisterBody),
  async (req, res, next) => {
    try {
      const doc = await registerCourier({
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

const RotateBody = z.object({ newSecret: z.string().min(16).max(200) });

couriersRouter.post(
  '/:code/rotate-secret',
  requireAuth,
  requirePermission('orders.update'),
  validate(RotateBody),
  async (req, res, next) => {
    try {
      const code = z.enum(['pathao', 'aramex']).parse(req.params.code);
      await rotateWebhookSecret({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        code,
        newSecret: req.body.newSecret,
      });
      res.json({ status: 'rotated', code });
    } catch (err) {
      next(err);
    }
  },
);

void COURIER_CODES;
