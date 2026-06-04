import { Router } from 'express';
import { z } from 'zod';

import { Coupon } from '../../db/models/index.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCoupon } from '../../services/catalogue/coupon.service.js';

export const couponsRouter: Router = Router();

couponsRouter.get('/', requireAuth, requirePermission('catalogue.update'), async (req, res, next) => {
  try {
    const docs = await Coupon.find({ tenantId: req.user!.tenantId }).sort({ createdAt: -1 }).lean();
    res.json({ data: docs });
  } catch (err) {
    next(err);
  }
});

const CreateCouponBody = z
  .object({
    code: z.string().min(2).max(40),
    name: z.string().max(120).optional(),
    description: z.string().max(2000).optional(),
    type: z.enum(['percentage', 'flat', 'free_ship', 'bogo']),
    value: z.number().nonnegative(),
    minSubtotal: z.number().nonnegative().optional(),
    maxDiscount: z.number().nonnegative().optional(),
    perUserLimit: z.number().int().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    productIds: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
    segments: z.array(z.string()).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
  })
  .strict();

couponsRouter.post(
  '/',
  requireAuth,
  requirePermission('catalogue.update'),
  validate(CreateCouponBody),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof CreateCouponBody>;
      const coupon = await createCoupon({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      });
      res.status(201).json(coupon);
    } catch (err) {
      next(err);
    }
  },
);
