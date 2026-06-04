import { randomBytes } from 'node:crypto';

import { Types } from 'mongoose';

import {
  Cart,
  CheckoutSession,
  Order,
  type CheckoutSessionDoc,
  type CartDoc,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { reserveStockForCart, releaseStockForItems } from '../catalogue/cart.service.js';
import { incrementUsage } from '../catalogue/coupon.service.js';

/**
 * 5-step checkout state machine (Address → Delivery → Review → Payment → Confirmation).
 *
 * Each PATCH advances the step. Stock is reserved on the transition from
 * `review → payment`, so a customer holding items in checkout has a soft hold
 * but no permanent commitment.
 */

const SESSION_TTL_MS = 30 * 60_000;
const TENANT_DEFAULT = '000000000000000000000001';

function makeOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(2).toString('hex').toUpperCase();
  return `UNI-${stamp}-${rand}`;
}

export interface CreateSessionInput {
  tenantId?: string;
  cart: CartDoc;
  userId?: string;
  guestEmail?: string;
}

export async function createSession(input: CreateSessionInput): Promise<CheckoutSessionDoc> {
  if (input.cart.items.length === 0) {
    throw new HttpError(409, 'CART_EMPTY', 'Cart is empty.');
  }
  const tenantId = input.tenantId ?? String(input.cart.tenantId) ?? TENANT_DEFAULT;
  const session = await CheckoutSession.create({
    tenantId,
    cartId: input.cart._id,
    userId: input.userId,
    guestEmail: input.guestEmail,
    step: 'address',
    status: 'active',
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return session;
}

async function loadActiveSession(sessionId: string, tenantId: string): Promise<CheckoutSessionDoc> {
  const session = await CheckoutSession.findOne({ _id: sessionId, tenantId });
  if (!session) throw new HttpError(404, 'SESSION_NOT_FOUND', 'Checkout session not found.');
  if (session.status !== 'active') throw new HttpError(409, 'SESSION_INACTIVE', 'Session is not active.');
  if (session.expiresAt < new Date()) {
    session.status = 'expired';
    await session.save();
    throw new HttpError(410, 'SESSION_EXPIRED', 'Session has expired.');
  }
  return session;
}

const STEP_ORDER: CheckoutSessionDoc['step'][] = ['address', 'delivery', 'review', 'payment', 'confirmation'];

function advanceTo(session: CheckoutSessionDoc, target: CheckoutSessionDoc['step']): void {
  const currentIdx = STEP_ORDER.indexOf(session.step);
  const targetIdx = STEP_ORDER.indexOf(target);
  if (targetIdx === -1 || targetIdx < currentIdx) {
    throw new HttpError(409, 'INVALID_STEP', `Cannot transition ${session.step} → ${target}.`);
  }
  session.step = target;
}

/* -------------------------------------------------------------------------- */

export interface SetAddressInput {
  sessionId: string;
  tenantId: string;
  address: Record<string, unknown>;
}

export async function setAddress(input: SetAddressInput): Promise<CheckoutSessionDoc> {
  const session = await loadActiveSession(input.sessionId, input.tenantId);
  session.addressSnapshot = input.address;
  advanceTo(session, 'delivery');
  await session.save();
  return session;
}

export interface SetDeliveryInput {
  sessionId: string;
  tenantId: string;
  method: string;
}

export async function setDelivery(input: SetDeliveryInput): Promise<CheckoutSessionDoc> {
  const session = await loadActiveSession(input.sessionId, input.tenantId);
  if (!session.addressSnapshot) throw new HttpError(409, 'ADDRESS_REQUIRED', 'Select an address first.');
  session.shippingMethod = input.method;
  advanceTo(session, 'review');
  await session.save();
  return session;
}

export interface InitPaymentInput {
  sessionId: string;
  tenantId: string;
  paymentMethod: 'esewa' | 'khalti' | 'stripe' | 'paypal' | 'cod';
}

export interface InitPaymentResult {
  session: CheckoutSessionDoc;
  /** Provider-specific init payload (stripe.clientSecret, esewa.signedUrl, etc.) */
  gatewayInit: Record<string, unknown>;
}

export async function initPayment(input: InitPaymentInput): Promise<InitPaymentResult> {
  const session = await loadActiveSession(input.sessionId, input.tenantId);
  if (!session.addressSnapshot || !session.shippingMethod) {
    throw new HttpError(409, 'CHECKOUT_INCOMPLETE', 'Complete address + delivery before payment.');
  }

  // Reserve stock here so a confirmed payment maps to held inventory.
  const cart = await Cart.findById(session.cartId);
  if (!cart) throw new HttpError(404, 'CART_NOT_FOUND', 'Cart no longer exists.');
  const failures = await reserveStockForCart(cart);
  if (failures.length > 0) {
    throw new HttpError(409, 'STOCK_UNAVAILABLE', 'Some items are no longer available.', failures);
  }

  session.paymentMethod = input.paymentMethod;
  advanceTo(session, 'payment');
  await session.save();

  const { initiatePayment } = await import('../payments/payments.service.js');
  const gatewayInit = await initiatePayment({
    method: input.paymentMethod,
    cart,
    session,
  });

  if (gatewayInit.providerRef) session.paymentRef = String(gatewayInit.providerRef);
  if (gatewayInit.clientSecret) session.paymentClientSecret = String(gatewayInit.clientSecret);
  await session.save();
  return { session, gatewayInit };
}

export interface ConfirmInput {
  sessionId: string;
  tenantId: string;
  gatewayRef: string;
  actorId?: string;
  ip?: string;
  ua?: string;
}

export async function confirmOrder(input: ConfirmInput) {
  const session = await loadActiveSession(input.sessionId, input.tenantId);
  if (session.step !== 'payment') {
    throw new HttpError(409, 'NOT_AT_PAYMENT', 'Session is not at the payment step.');
  }
  const cart = await Cart.findById(session.cartId);
  if (!cart) throw new HttpError(404, 'CART_NOT_FOUND', 'Cart no longer exists.');

  // Verify the gateway result (eSewa/Khalti hand back signed payloads).
  const { verifyPayment } = await import('../payments/payments.service.js');
  const verified = await verifyPayment({
    method: session.paymentMethod ?? 'cod',
    cart,
    session,
    gatewayRef: input.gatewayRef,
  });
  if (!verified.ok) {
    // Release reserved stock back to available.
    await releaseStockForItems(String(cart.tenantId), cart.items.map((it) => ({ sku: it.sku, qty: it.qty })));
    throw new HttpError(402, 'PAYMENT_FAILED', verified.message ?? 'Payment was not confirmed.');
  }

  const order = await Order.create({
    tenantId: cart.tenantId,
    number: makeOrderNumber(),
    userId: session.userId,
    guestEmail: session.guestEmail,
    status: session.paymentMethod === 'cod' ? 'confirmed' : 'confirmed',
    items: cart.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      sku: it.sku,
      name: it.snapshotName ?? '',
      qty: it.qty,
      unitPrice: it.unitPrice,
      subtotal: it.unitPrice * it.qty,
    })),
    totals: cart.totals,
    currency: cart.currency,
    couponCode: cart.coupon?.code,
    payment: {
      method: session.paymentMethod,
      status: session.paymentMethod === 'cod' ? 'pending' : 'paid',
      gatewayRef: input.gatewayRef,
      paidAt: session.paymentMethod === 'cod' ? undefined : new Date(),
    },
    shipping: {
      address: session.addressSnapshot,
      method: session.shippingMethod,
    },
    statusHistory: [
      { from: 'pending', to: 'confirmed', changedBy: input.actorId, ts: new Date() },
    ],
  });

  // Mark session done + clear cart.
  session.step = 'confirmation';
  session.status = 'completed';
  await session.save();

  if (cart.coupon?.code) {
    const { Coupon } = await import('../../db/models/index.js');
    const coupon = await Coupon.findOne({ tenantId: cart.tenantId, code: cart.coupon.code }).select('_id');
    if (coupon) await incrementUsage(String(coupon._id));
  }

  cart.items = [];
  cart.coupon = undefined as unknown as CartDoc['coupon'];
  cart.totals = { subtotal: 0, discount: 0, deliveryFee: 0, tax: 0, total: 0 };
  await cart.save();

  await audit({
    tenantId: cart.tenantId,
    actorId: input.actorId ?? session.userId,
    action: 'order.created',
    entity: 'Order',
    entityId: order._id,
    afterJson: { number: order.number, total: order.totals.total },
    ip: input.ip,
    ua: input.ua,
  });

  return order;
}

void Types;
