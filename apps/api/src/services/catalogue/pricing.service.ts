import type { CartDoc } from '../../db/models/index.js';

/**
 * Pricing helper — single source of truth for cart + checkout totals.
 *
 * All money values are integers in minor currency units to dodge floating-point
 * drift. The full tax engine lives in Phase 6 (FR-014); Phase 3 plumbs a flat
 * per-cart tax computation hook so the storefront sees a tax line that's wired
 * end-to-end.
 */

export interface PricingBreakdown {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
}

export interface PricingInput {
  items: CartDoc['items'];
  couponAmount?: number;
  freeShip?: boolean;
  baseDeliveryFee?: number;
  taxRatePct?: number;
}

export function priceCart(input: PricingInput): PricingBreakdown {
  const subtotal = input.items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const discount = Math.min(input.couponAmount ?? 0, subtotal);
  const baseDelivery = input.baseDeliveryFee ?? 0;
  const deliveryFee = input.freeShip ? 0 : baseDelivery;
  const taxableBase = subtotal - discount;
  const tax = Math.round(taxableBase * ((input.taxRatePct ?? 0) / 100));
  const total = Math.max(0, taxableBase + deliveryFee + tax);
  return { subtotal, discount, deliveryFee, tax, total };
}
