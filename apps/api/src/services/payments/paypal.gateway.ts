import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../config/logger.js';
import type {
  InitiateInput,
  InitiateOutput,
  PaymentGateway,
  RefundInput,
  RefundOutput,
  VerifyInput,
  VerifyOutput,
  WebhookInput,
  WebhookOutput,
} from './types.js';

function clientId(): string {
  return process.env.PAYPAL_CLIENT_ID ?? 'dev-paypal-client';
}

function clientSecret(): string {
  return process.env.PAYPAL_CLIENT_SECRET ?? 'dev-paypal-secret';
}

export const paypalGateway: PaymentGateway = {
  method: 'paypal',

  async initiate(input: InitiateInput): Promise<InitiateOutput> {
    const orderId = `PP-${Date.now()}-${String(input.cart._id).slice(-6)}`;
    logger.info({ orderId, amount: input.cart.totals.total }, 'paypal.initiate');
    return {
      providerRef: orderId,
      extra: {
        clientId: clientId(),
        orderId,
        amount: (input.cart.totals.total / 100).toFixed(2),
        currency: input.cart.currency ?? 'USD',
      },
    };
  },

  async verify(input: VerifyInput): Promise<VerifyOutput> {
    // TODO(phase-3.6): POST /v2/checkout/orders/{id}/capture, then check status === 'COMPLETED'.
    return { ok: Boolean(input.gatewayRef), amount: input.cart.totals.total, currency: input.cart.currency ?? 'USD' };
  },

  async refund(input: RefundInput): Promise<RefundOutput> {
    // TODO(phase-3.6): POST /v2/payments/captures/{capture_id}/refund.
    return { ok: true, providerRefundId: `PP-RE-${Date.now()}-${input.orderId.slice(-6)}` };
  },

  verifyWebhookSignature({ rawBody, headers }: WebhookInput): boolean {
    const sigHeader = headers['paypal-transmission-sig'];
    if (!sigHeader || Array.isArray(sigHeader)) return false;
    // PayPal verification needs a remote `verify-webhook-signature` API call; for
    // the v1 boundary we HMAC the body with the client secret as a placeholder.
    const expected = createHmac('sha256', clientSecret()).update(rawBody).digest('base64');
    if (expected.length !== sigHeader.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
    } catch {
      return false;
    }
  },

  parseWebhook({ rawBody }: WebhookInput): WebhookOutput {
    const payload = JSON.parse(rawBody.toString('utf8')) as { id?: string; event_type?: string };
    return {
      externalEventId: payload.id ?? `${Date.now()}`,
      type: payload.event_type ?? 'unknown',
      payload,
    };
  },
};
