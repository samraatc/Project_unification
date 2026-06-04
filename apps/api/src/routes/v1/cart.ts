import { Router } from 'express';
import { z } from 'zod';

import { Cart, CheckoutSession, Order } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  addItem,
  applyCoupon,
  getCart,
  newGuestToken,
  removeCoupon,
  removeItem,
  updateItemQty,
} from '../../services/catalogue/cart.service.js';
import {
  confirmOrder,
  createSession,
  initPayment,
  setAddress,
  setDelivery,
} from '../../services/checkout/checkout.service.js';

export const cartRouter: Router = Router();
export const checkoutRouter: Router = Router();

const GUEST_COOKIE = 'guest_token';
const TENANT_DEFAULT = '000000000000000000000001';

function ctxFromReq(req: import('express').Request, res: import('express').Response) {
  const tenantId = req.user?.tenantId ?? TENANT_DEFAULT;
  if (req.user?.sub) return { tenantId, userId: req.user.sub };
  let guestToken = req.cookies?.[GUEST_COOKIE] as string | undefined;
  if (!guestToken) {
    guestToken = newGuestToken();
    res.cookie(GUEST_COOKIE, guestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600 * 1000,
      path: '/',
    });
  }
  return { tenantId, guestToken };
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                       */
/* -------------------------------------------------------------------------- */

cartRouter.get('/', async (req, res, next) => {
  try {
    const ctx = ctxFromReq(req, res);
    const cart = await getCart(ctx);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

const AddItemBody = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  qty: z.number().int().min(1).max(99),
});

cartRouter.post('/items', validate(AddItemBody), async (req, res, next) => {
  try {
    const ctx = ctxFromReq(req, res);
    const cart = await addItem({ ...ctx, ...(req.body as z.infer<typeof AddItemBody>) });
    res.status(201).json(cart);
  } catch (err) {
    next(err);
  }
});

const PatchItemBody = z.object({ qty: z.number().int().min(0).max(99) });

cartRouter.patch('/items/:itemId', validate(PatchItemBody), async (req, res, next) => {
  try {
    const ctx = ctxFromReq(req, res);
    const cart = await updateItemQty({ ...ctx, itemId: req.params.itemId, qty: req.body.qty });
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

cartRouter.delete('/items/:itemId', async (req, res, next) => {
  try {
    const ctx = ctxFromReq(req, res);
    const cart = await removeItem({ ...ctx, itemId: req.params.itemId });
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

const CouponBody = z.object({ code: z.string().min(2).max(40) });

cartRouter.post('/coupon', validate(CouponBody), async (req, res, next) => {
  try {
    const ctx = ctxFromReq(req, res);
    const result = await applyCoupon({ ...ctx, code: req.body.code });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

cartRouter.delete('/coupon', async (req, res, next) => {
  try {
    const ctx = ctxFromReq(req, res);
    const cart = await removeCoupon(ctx);
    res.json(cart);
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------------- */
/* Checkout                                                                   */
/* -------------------------------------------------------------------------- */

const StartCheckoutBody = z.object({ guestEmail: z.string().email().optional() });

checkoutRouter.post('/session', validate(StartCheckoutBody), async (req, res, next) => {
  try {
    const ctx = ctxFromReq(req, res);
    const cart = await getCart(ctx);
    if (cart.items.length === 0) throw new HttpError(409, 'CART_EMPTY', 'Cart is empty.');
    const session = await createSession({
      tenantId: ctx.tenantId,
      cart,
      userId: ctx.userId,
      guestEmail: req.body.guestEmail,
    });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

const AddressBody = z.object({
  addressId: z.string().optional(),
  address: z
    .object({
      line1: z.string().min(1).max(200),
      line2: z.string().max(200).optional(),
      city: z.string().min(1).max(120),
      region: z.string().max(120).optional(),
      postalCode: z.string().max(20).optional(),
      country: z.string().min(2).max(2),
      contactName: z.string().min(1).max(200),
      contactPhone: z.string().max(40),
    })
    .optional(),
});

checkoutRouter.patch('/session/:id/address', validate(AddressBody), async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId ?? TENANT_DEFAULT;
    const session = await setAddress({
      sessionId: req.params.id,
      tenantId,
      address: (req.body.address ?? { addressId: req.body.addressId }) as Record<string, unknown>,
    });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

const DeliveryBody = z.object({ method: z.enum(['standard', 'express', 'pickup']) });

checkoutRouter.patch('/session/:id/delivery', validate(DeliveryBody), async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId ?? TENANT_DEFAULT;
    const session = await setDelivery({ sessionId: req.params.id, tenantId, method: req.body.method });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

const PaymentBody = z.object({
  method: z.enum(['esewa', 'khalti', 'stripe', 'paypal', 'cod']),
});

checkoutRouter.post('/session/:id/payment', validate(PaymentBody), async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId ?? TENANT_DEFAULT;
    const result = await initPayment({
      sessionId: req.params.id,
      tenantId,
      paymentMethod: req.body.method,
    });
    res.json({ session: result.session, gateway: result.gatewayInit });
  } catch (err) {
    next(err);
  }
});

const ConfirmBody = z.object({ gatewayRef: z.string().min(1) });

checkoutRouter.post('/session/:id/confirm', validate(ConfirmBody), async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId ?? TENANT_DEFAULT;
    const order = await confirmOrder({
      sessionId: req.params.id,
      tenantId,
      gatewayRef: req.body.gatewayRef,
      actorId: req.user?.sub,
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

void Cart;
void CheckoutSession;
void Order;
