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

/**
 * Stripe adapter.
 *
 * v1 uses Stripe Elements (PCI-DSS SAQ-A — Security-Requirements §10). The
 * client picks the card form; the server only ever sees the PaymentIntent id.
 * Phase 3.5 wires the real `stripe` SDK; this scaffold ships the contract
 * + dev stubs so the end-to-end flow round-trips against a stubbed gateway.
 */
function secret(): string {
  return process.env.STRIPE_SECRET_KEY ?? 'sk_test_dev';
}

function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_dev';
}

export const stripeGateway: PaymentGateway = {
  method: 'stripe',

  async initiate(input: InitiateInput): Promise<InitiateOutput> {
    // TODO(phase-3.5): real call to stripe.paymentIntents.create({ amount, currency, automatic_payment_methods }).
    const intentId = `pi_dev_${Date.now()}`;
    const clientSecret = `${intentId}_secret_dev`;
    logger.info({ cartId: String(input.cart._id), amount: input.cart.totals.total }, 'stripe.initiate (stub)');
    return { providerRef: intentId, clientSecret };
  },

  async verify(input: VerifyInput): Promise<VerifyOutput> {
    // TODO(phase-3.5): stripe.paymentIntents.retrieve(input.gatewayRef) then check status === 'succeeded'.
    return { ok: true, amount: input.cart.totals.total, currency: input.cart.currency ?? 'USD' };
  },

  async refund(input: RefundInput): Promise<RefundOutput> {
    // TODO(phase-3.5): stripe.refunds.create({ payment_intent, amount }).
    return { ok: true, providerRefundId: `re_dev_${Date.now()}` };
  },

  verifyWebhookSignature({ rawBody, headers }: WebhookInput): boolean {
    // Stripe sends `Stripe-Signature: t=<ts>,v1=<sig>`. Verify HMAC over `${t}.${rawBody}`.
    const header = headers['stripe-signature'];
    if (!header || Array.isArray(header)) return false;
    const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return false;
    const expected = createHmac('sha256', webhookSecret()).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
    if (expected.length !== v1.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
    } catch {
      return false;
    }
  },

  parseWebhook({ rawBody }: WebhookInput): WebhookOutput {
    const payload = JSON.parse(rawBody.toString('utf8')) as { id?: string; type?: string };
    return {
      externalEventId: payload.id ?? `evt_${Date.now()}`,
      type: payload.type ?? 'unknown',
      payload,
    };
  },
};

void secret;
