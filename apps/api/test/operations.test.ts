/** Phase 4 — order state machine + courier signature tests. */
import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { isValidTransition } from '../src/services/orders/stateMachine.js';
import { courierProvider, COURIER_CODES } from '../src/services/couriers/providers/index.js';

describe('order state machine', () => {
  it('allows the happy path', () => {
    expect(isValidTransition('pending', 'confirmed')).toBe(true);
    expect(isValidTransition('confirmed', 'processing')).toBe(true);
    expect(isValidTransition('processing', 'shipped')).toBe(true);
    expect(isValidTransition('shipped', 'delivered')).toBe(true);
  });

  it('blocks invalid edges', () => {
    expect(isValidTransition('pending', 'shipped')).toBe(false);
    expect(isValidTransition('delivered', 'pending')).toBe(false);
    expect(isValidTransition('refunded', 'pending')).toBe(false);
  });

  it('permits cancellation only from open states', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
    expect(isValidTransition('confirmed', 'cancelled')).toBe(true);
    expect(isValidTransition('processing', 'cancelled')).toBe(true);
    expect(isValidTransition('shipped', 'cancelled')).toBe(false);
    expect(isValidTransition('delivered', 'cancelled')).toBe(false);
  });

  it('permits return only after shipment', () => {
    expect(isValidTransition('shipped', 'returned')).toBe(true);
    expect(isValidTransition('delivered', 'returned')).toBe(true);
    expect(isValidTransition('pending', 'returned')).toBe(false);
  });
});

describe('courier providers', () => {
  it('exposes one provider per supported code', () => {
    for (const code of COURIER_CODES) {
      const p = courierProvider(code);
      expect(p.code).toBe(code);
      expect(typeof p.trackingUrl('TRK1')).toBe('string');
      expect(typeof p.verifyWebhookSignature).toBe('function');
      expect(typeof p.parseScanEvent).toBe('function');
    }
  });

  it('Pathao verifier accepts a valid HMAC + bearer', () => {
    const p = courierProvider('pathao');
    const secret = 'super-secret-pathao-token';
    const body = Buffer.from(JSON.stringify({ consignment_id: 'CNG1', order_status: 'in_transit' }));
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(
      p.verifyWebhookSignature({
        rawBody: body,
        headers: { authorization: `Bearer ${secret}`, 'x-pathao-signature': sig },
        sharedSecret: secret,
      }),
    ).toBe(true);
    expect(
      p.verifyWebhookSignature({
        rawBody: body,
        headers: { authorization: `Bearer wrong-token`, 'x-pathao-signature': sig },
        sharedSecret: secret,
      }),
    ).toBe(false);
  });

  it('Aramex verifier accepts sha256= form', () => {
    const p = courierProvider('aramex');
    const secret = 'aramex-shared-secret';
    const body = Buffer.from(
      JSON.stringify({ ShipmentNumber: 'AR1', TrackingResults: [{ UpdateCode: 'SH005', UpdateDescription: 'Delivered' }] }),
    );
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(
      p.verifyWebhookSignature({
        rawBody: body,
        headers: { 'x-aramex-signature': `sha256=${sig}` },
        sharedSecret: secret,
      }),
    ).toBe(true);
    const tampered = Buffer.from('{"ShipmentNumber":"hacked"}');
    expect(
      p.verifyWebhookSignature({
        rawBody: tampered,
        headers: { 'x-aramex-signature': `sha256=${sig}` },
        sharedSecret: secret,
      }),
    ).toBe(false);
  });
});
