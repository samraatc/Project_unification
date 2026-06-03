import { Coupon, type CouponDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';

/**
 * Coupon engine — PRD §3.2.
 *
 * Validation is server-only; the client never trusts a client-computed total
 * (Security-Requirements §5). The cart.service calls `applyCoupon` when the
 * customer attaches a code, and `unapplyCoupon` when they remove it.
 */

export interface ValidationContext {
  tenantId: string;
  /** Subtotal in minor currency units. */
  subtotal: number;
  productIds: string[];
  categoryIds: string[];
  segments: string[];
  userId?: string;
}

export interface DiscountResult {
  code: string;
  type: CouponDoc['type'];
  /** Discount in minor currency units. */
  amount: number;
  /** True for `free_ship` — caller still applies the delivery-fee waiver. */
  freeShip: boolean;
  message: string;
}

export async function validateCoupon(
  code: string,
  ctx: ValidationContext,
): Promise<{ coupon: CouponDoc; discount: DiscountResult }> {
  const now = new Date();
  const coupon = await Coupon.findOne({ tenantId: ctx.tenantId, code: code.toUpperCase() });
  if (!coupon) throw new HttpError(404, 'COUPON_INVALID', 'Coupon not found.');
  if (coupon.status !== 'active') throw new HttpError(409, 'COUPON_INACTIVE', 'Coupon is not active.');
  if (coupon.startsAt && coupon.startsAt > now) throw new HttpError(409, 'COUPON_NOT_STARTED', 'Coupon has not started yet.');
  if (coupon.endsAt && coupon.endsAt < now) throw new HttpError(409, 'COUPON_EXPIRED', 'Coupon has expired.');
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw new HttpError(409, 'COUPON_EXHAUSTED', 'Coupon has reached its usage limit.');
  }
  if (coupon.minSubtotal && ctx.subtotal < coupon.minSubtotal) {
    throw new HttpError(409, 'COUPON_MIN_NOT_MET', `Minimum subtotal not met.`);
  }
  if (coupon.productIds?.length) {
    const overlap = ctx.productIds.some((p) => coupon.productIds.map(String).includes(p));
    if (!overlap) throw new HttpError(409, 'COUPON_NOT_ELIGIBLE', 'Coupon is not eligible for items in your cart.');
  }
  if (coupon.categoryIds?.length) {
    const overlap = ctx.categoryIds.some((p) => coupon.categoryIds.map(String).includes(p));
    if (!overlap) throw new HttpError(409, 'COUPON_NOT_ELIGIBLE', 'Coupon is not eligible for these categories.');
  }
  if (coupon.segments?.length) {
    const overlap = ctx.segments.some((s) => coupon.segments.includes(s));
    if (!overlap) throw new HttpError(409, 'COUPON_SEGMENT_MISMATCH', 'Coupon is not available for this customer.');
  }

  const discount = computeDiscount(coupon, ctx.subtotal);
  return { coupon, discount };
}

function computeDiscount(coupon: CouponDoc, subtotal: number): DiscountResult {
  let amount = 0;
  let freeShip = false;
  let message = '';
  switch (coupon.type) {
    case 'percentage': {
      amount = Math.round((subtotal * coupon.value) / 100);
      if (coupon.maxDiscount) amount = Math.min(amount, coupon.maxDiscount);
      message = `${coupon.value}% off`;
      break;
    }
    case 'flat': {
      amount = Math.min(coupon.value, subtotal);
      message = `${coupon.value} off`;
      break;
    }
    case 'free_ship': {
      freeShip = true;
      message = 'Free shipping';
      break;
    }
    case 'bogo': {
      // Phase 3.2 treats BOGO as a 50% discount on the cheapest matching item; the
      // line-item resolver lands with the full pricing engine in Phase 5.
      amount = Math.round(subtotal * 0.5 * (coupon.value / 100));
      message = 'Buy one, get one';
      break;
    }
  }
  return { code: coupon.code, type: coupon.type, amount, freeShip, message };
}

export async function incrementUsage(couponId: string): Promise<void> {
  await Coupon.updateOne({ _id: couponId }, { $inc: { usageCount: 1 } });
}

/* -------------------------------------------------------------------------- */
/* Admin CRUD                                                                 */
/* -------------------------------------------------------------------------- */

export interface CreateCouponInput {
  tenantId: string;
  actorId: string;
  code: string;
  type: CouponDoc['type'];
  value: number;
  name?: string;
  description?: string;
  minSubtotal?: number;
  maxDiscount?: number;
  perUserLimit?: number;
  usageLimit?: number;
  productIds?: string[];
  categoryIds?: string[];
  segments?: string[];
  startsAt?: Date;
  endsAt?: Date;
  ip?: string;
  ua?: string;
}

export async function createCoupon(input: CreateCouponInput): Promise<CouponDoc> {
  const existing = await Coupon.findOne({ tenantId: input.tenantId, code: input.code.toUpperCase() });
  if (existing) throw new HttpError(409, 'COUPON_EXISTS', 'A coupon with that code already exists.');
  const doc = await Coupon.create({
    tenantId: input.tenantId,
    code: input.code,
    name: input.name,
    description: input.description,
    type: input.type,
    value: input.value,
    minSubtotal: input.minSubtotal,
    maxDiscount: input.maxDiscount,
    perUserLimit: input.perUserLimit,
    usageLimit: input.usageLimit,
    productIds: input.productIds,
    categoryIds: input.categoryIds,
    segments: input.segments,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    createdBy: input.actorId,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'coupon.created',
    entity: 'Coupon',
    entityId: doc._id,
    afterJson: { code: input.code, type: input.type, value: input.value },
    ip: input.ip,
    ua: input.ua,
  });
  return doc;
}
