import { Router } from 'express';
import { z } from 'zod';

import { Invoice, Subscription } from '../../db/models/index.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { cancelSubscription, startCheckout } from '../../services/billing/billing.service.js';
import { PLANS, type PlanCode } from '../../services/billing/plans.js';

export const billingRouter: Router = Router();

/** Public — plan catalogue for the storefront. */
billingRouter.get('/plans', (_req, res) => {
  res.json({
    data: PLANS.map((p) => ({
      code: p.code,
      name: p.name,
      amountUsd: p.amountUsd,
      amountNpr: p.amountNpr,
      cycle: p.cycle,
      seats: p.seats,
      bestFor: p.bestFor,
      trialDays: p.trialDays,
      entitlements: p.entitlements,
    })),
  });
});

billingRouter.get(
  '/subscription',
  requireAuth,
  requirePermission('billing.read'),
  async (req, res, next) => {
    try {
      const sub = await Subscription.findOne({ tenantId: req.user!.tenantId }).lean();
      res.json(sub ?? { status: 'none', entitlements: [] });
    } catch (err) {
      next(err);
    }
  },
);

const CheckoutBody = z.object({
  plan: z.enum(['trial', 'monthly', 'yearly', 'lifetime', 'enterprise']),
  provider: z.enum(['stripe', 'esewa', 'khalti']),
  returnUrl: z.string().url(),
  cancelUrl: z.string().url(),
  customer: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().max(40).optional(),
      name: z.string().max(200).optional(),
    })
    .default({}),
});

billingRouter.post(
  '/checkout',
  requireAuth,
  requirePermission('billing.purchase'),
  validate(CheckoutBody),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof CheckoutBody>;
      const handoff = await startCheckout({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        plan: body.plan as PlanCode,
        provider: body.provider,
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl,
        customer: body.customer,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(handoff);
    } catch (err) {
      next(err);
    }
  },
);

const CancelBody = z.object({ reason: z.string().max(2000).optional() });

billingRouter.post(
  '/subscription/cancel',
  requireAuth,
  requirePermission('billing.cancel'),
  validate(CancelBody),
  async (req, res, next) => {
    try {
      await cancelSubscription({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        reason: req.body.reason,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

billingRouter.get(
  '/invoices',
  requireAuth,
  requirePermission('billing.read'),
  async (req, res, next) => {
    try {
      const docs = await Invoice.find({ tenantId: req.user!.tenantId })
        .sort({ issuedAt: -1 })
        .limit(100)
        .lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);
