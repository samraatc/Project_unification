import { randomBytes } from 'node:crypto';

import { Types } from 'mongoose';

import {
  Cart,
  Inventory,
  Product,
  type CartDoc,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { priceCart } from './pricing.service.js';
import { validateCoupon, type DiscountResult } from './coupon.service.js';

/**
 * Cart service — persistent for logged-in users, guest-tokened otherwise.
 *
 * Stock validation runs atomically on `findOneAndUpdate` so two concurrent
 * "add to cart" calls for the last unit can't both succeed (Database.md §10).
 */

const TENANT_DEFAULT = '000000000000000000000001';

export function newGuestToken(): string {
  return randomBytes(24).toString('base64url');
}

export interface CartContext {
  tenantId?: string;
  userId?: string;
  guestToken?: string;
}

async function ensureCart(ctx: CartContext): Promise<CartDoc> {
  const tenantId = ctx.tenantId ?? TENANT_DEFAULT;
  if (!ctx.userId && !ctx.guestToken) {
    throw new HttpError(400, 'CART_NEEDS_IDENTITY', 'Provide userId or guestToken.');
  }
  const query = ctx.userId ? { tenantId, userId: ctx.userId } : { tenantId, guestToken: ctx.guestToken };
  let cart = await Cart.findOne(query);
  if (!cart) {
    cart = await Cart.create({ tenantId, ...query, items: [], totals: {} });
  }
  return cart;
}

export async function getCart(ctx: CartContext): Promise<CartDoc> {
  return ensureCart(ctx);
}

export interface AddItemInput extends CartContext {
  productId: string;
  variantId?: string;
  qty: number;
  ip?: string;
  ua?: string;
}

export async function addItem(input: AddItemInput): Promise<CartDoc> {
  const product = await Product.findOne({ _id: input.productId, status: 'active' });
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const variant = input.variantId
    ? product.variants?.find((v) => String(v._id) === input.variantId)
    : undefined;
  const sku = variant?.sku ?? product.sku;
  const unitPrice = (variant?.salePrice ?? variant?.price ?? product.salePrice ?? product.basePrice) | 0;

  // Atomic stock check — reserves nothing yet, just guards.
  const inv = await Inventory.findOne({ tenantId: input.tenantId ?? TENANT_DEFAULT, sku });
  if (!inv || inv.available < input.qty) {
    throw new HttpError(409, 'OUT_OF_STOCK', `Only ${inv?.available ?? 0} left in stock.`);
  }

  const cart = await ensureCart(input);
  const existing = cart.items.find((it) => it.sku === sku);
  if (existing) {
    existing.qty += input.qty;
  } else {
    cart.items.push({
      productId: product._id as unknown as CartDoc['items'][number]['productId'],
      variantId: variant?._id as unknown as CartDoc['items'][number]['variantId'],
      sku,
      qty: input.qty,
      unitPrice,
      snapshotName: product.name,
      snapshotImage: product.images?.[0]?.url,
    } as CartDoc['items'][number]);
  }

  recomputeTotals(cart);
  await cart.save();
  return cart;
}

export interface UpdateItemInput extends CartContext {
  itemId: string;
  qty: number;
}

export async function updateItemQty(input: UpdateItemInput): Promise<CartDoc> {
  const cart = await ensureCart(input);
  const item = cart.items.find((it) => String(it._id) === input.itemId);
  if (!item) throw new HttpError(404, 'ITEM_NOT_FOUND', 'Cart item not found.');
  if (input.qty <= 0) {
    cart.items = cart.items.filter((it) => String(it._id) !== input.itemId);
  } else {
    const inv = await Inventory.findOne({ tenantId: cart.tenantId, sku: item.sku });
    if (!inv || inv.available < input.qty) {
      throw new HttpError(409, 'OUT_OF_STOCK', `Only ${inv?.available ?? 0} left in stock.`);
    }
    item.qty = input.qty;
  }
  recomputeTotals(cart);
  await cart.save();
  return cart;
}

export interface RemoveItemInput extends CartContext {
  itemId: string;
}

export async function removeItem(input: RemoveItemInput): Promise<CartDoc> {
  const cart = await ensureCart(input);
  cart.items = cart.items.filter((it) => String(it._id) !== input.itemId);
  recomputeTotals(cart);
  await cart.save();
  return cart;
}

export interface ApplyCouponInput extends CartContext {
  code: string;
}

export async function applyCoupon(input: ApplyCouponInput): Promise<CartDoc & { discount: DiscountResult }> {
  const cart = await ensureCart(input);
  if (cart.items.length === 0) {
    throw new HttpError(409, 'CART_EMPTY', 'Add items before applying a coupon.');
  }
  const productIds = [...new Set(cart.items.map((i) => String(i.productId)))];
  const categoryIds = (
    await Product.find({ _id: { $in: productIds } }).select('categories').lean()
  ).flatMap((p) => (p.categories ?? []).map(String));
  const { discount } = await validateCoupon(input.code, {
    tenantId: String(cart.tenantId),
    subtotal: cart.items.reduce((s, it) => s + it.unitPrice * it.qty, 0),
    productIds,
    categoryIds,
    segments: [],
    userId: input.userId,
  });
  cart.coupon = {
    code: discount.code,
    type: discount.type,
    value: discount.amount,
    validatedAt: new Date(),
  };
  recomputeTotals(cart, discount);
  await cart.save();
  return Object.assign(cart, { discount });
}

export async function removeCoupon(input: CartContext): Promise<CartDoc> {
  const cart = await ensureCart(input);
  cart.coupon = undefined as unknown as CartDoc['coupon'];
  recomputeTotals(cart);
  await cart.save();
  return cart;
}

export interface MergeOnLoginInput {
  tenantId: string;
  userId: string;
  guestToken: string;
  ip?: string;
  ua?: string;
}

export async function mergeGuestCartOnLogin(input: MergeOnLoginInput): Promise<CartDoc | null> {
  const guest = await Cart.findOne({ tenantId: input.tenantId, guestToken: input.guestToken });
  if (!guest) return Cart.findOne({ tenantId: input.tenantId, userId: input.userId });
  let user = await Cart.findOne({ tenantId: input.tenantId, userId: input.userId });
  if (!user) {
    guest.userId = new Types.ObjectId(input.userId) as unknown as CartDoc['userId'];
    guest.guestToken = undefined as unknown as string;
    await guest.save();
    user = guest;
  } else {
    for (const item of guest.items) {
      const existing = user.items.find((it) => it.sku === item.sku);
      if (existing) existing.qty += item.qty;
      else user.items.push(item);
    }
    recomputeTotals(user);
    await user.save();
    await guest.deleteOne();
  }
  await audit({
    tenantId: input.tenantId,
    actorId: input.userId,
    action: 'cart.merged',
    entity: 'Cart',
    entityId: user._id,
    ip: input.ip,
    ua: input.ua,
  });
  return user;
}

function recomputeTotals(cart: CartDoc, discount?: DiscountResult): void {
  const breakdown = priceCart({
    items: cart.items,
    couponAmount: discount?.amount ?? cart.coupon?.value,
    freeShip: discount?.freeShip,
    baseDeliveryFee: 0, // configured per region in Phase 4.
    taxRatePct: 0,
  });
  cart.totals = breakdown;
}

/**
 * Atomic reservation — called by checkout.service when the customer hits
 * "place order". Returns the list of SKUs that failed so the UI can offer
 * "remove" or "wait for restock".
 */
export interface ReservationFailure {
  sku: string;
  requested: number;
  available: number;
}

export async function reserveStockForCart(cart: CartDoc): Promise<ReservationFailure[]> {
  const failures: ReservationFailure[] = [];
  for (const item of cart.items) {
    // eslint-disable-next-line no-await-in-loop -- per-SKU atomic guard
    const updated = await Inventory.findOneAndUpdate(
      {
        tenantId: cart.tenantId,
        sku: item.sku,
        available: { $gte: item.qty },
      },
      {
        $inc: { reserved: item.qty, available: -item.qty },
      },
      { new: true },
    );
    if (!updated) {
      const inv = await Inventory.findOne({ tenantId: cart.tenantId, sku: item.sku }).lean();
      failures.push({ sku: item.sku, requested: item.qty, available: inv?.available ?? 0 });
    }
  }
  return failures;
}

export async function releaseStockForItems(
  tenantId: string,
  items: Array<{ sku: string; qty: number }>,
): Promise<void> {
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    await Inventory.updateOne(
      { tenantId, sku: item.sku },
      { $inc: { reserved: -item.qty, available: item.qty } },
    );
  }
}
