/** Phase 3 — catalogue + pricing + payment-gateway smoke tests. */
import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { priceCart } from '../src/services/catalogue/pricing.service.js';
import { gatewayFor, PAYMENT_METHODS } from '../src/services/payments/payments.service.js';

describe('priceCart', () => {
  it('subtotal + tax minus discount + delivery = total (integer math)', () => {
    const items = [
      { sku: 'A', qty: 2, unitPrice: 1000 } as never,
      { sku: 'B', qty: 1, unitPrice: 500 } as never,
    ];
    const b = priceCart({ items, couponAmount: 200, baseDeliveryFee: 100, taxRatePct: 10 });
    expect(b.subtotal).toBe(2500);
    expect(b.discount).toBe(200);
    expect(b.deliveryFee).toBe(100);
    // 10% of (2500-200) = 230
    expect(b.tax).toBe(230);
    expect(b.total).toBe(2630);
  });

  it('clamps the discount to subtotal', () => {
    const items = [{ sku: 'A', qty: 1, unitPrice: 500 } as never];
    const b = priceCart({ items, couponAmount: 999_999, baseDeliveryFee: 0, taxRatePct: 0 });
    expect(b.discount).toBe(500);
    expect(b.total).toBe(0);
  });

  it('free_ship coupon zeroes the delivery fee', () => {
    const items = [{ sku: 'A', qty: 1, unitPrice: 500 } as never];
    const b = priceCart({ items, freeShip: true, baseDeliveryFee: 200 });
    expect(b.deliveryFee).toBe(0);
  });
});

describe('payment gateways', () => {
  it('exposes the same shape per provider', async () => {
    for (const m of PAYMENT_METHODS) {
      const g = gatewayFor(m);
      expect(g.method).toBe(m);
      expect(typeof g.initiate).toBe('function');
      expect(typeof g.verify).toBe('function');
      expect(typeof g.refund).toBe('function');
      expect(typeof g.verifyWebhookSignature).toBe('function');
      expect(typeof g.parseWebhook).toBe('function');
    }
  });

  it('Stripe verifier accepts a valid signed body and rejects tampered ones', () => {
    const stripe = gatewayFor('stripe');
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_dev';
    const body = Buffer.from(JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded' }), 'utf8');
    const t = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', secret).update(`${t}.${body.toString('utf8')}`).digest('hex');
    expect(
      stripe.verifyWebhookSignature({ rawBody: body, headers: { 'stripe-signature': `t=${t},v1=${sig}` } }),
    ).toBe(true);
    expect(
      stripe.verifyWebhookSignature({
        rawBody: Buffer.from('tampered'),
        headers: { 'stripe-signature': `t=${t},v1=${sig}` },
      }),
    ).toBe(false);
  });

  it('eSewa initiate returns a redirect + signature', async () => {
    const g = gatewayFor('esewa');
    const out = await g.initiate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal cart stub
      cart: { _id: 'c1', totals: { total: 250_00 }, currency: 'NPR', items: [] } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session: {} as any,
    });
    expect(out.redirectUrl).toMatch(/^https?:\/\//);
    expect(out.extra?.signature).toBeTruthy();
  });
});
