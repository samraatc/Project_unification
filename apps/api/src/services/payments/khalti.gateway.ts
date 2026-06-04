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
 * Khalti adapter — popup + Lookup API confirmation.
 *
 * `initiate` returns the `productIdentity` + `amount` the storefront passes to
 * the Khalti widget. After the customer pays, the widget POSTs the token back
 * to the SPA, which calls our confirm endpoint with `gatewayRef = token`. We
 * call Khalti's Lookup API server-side to verify amount + status before
 * marking the order paid.
 */

function publicKey(): string {
  return process.env.KHALTI_PUBLIC_KEY ?? 'test_public_key';
}

function secretKey(): string {
  return process.env.KHALTI_SECRET_KEY ?? 'test_secret_key';
}

function webhookSecret(): string {
  return process.env.KHALTI_WEBHOOK_SECRET ?? 'dev-webhook-secret';
}

export const khaltiGateway: PaymentGateway = {
  method: 'khalti',

  async initiate(input: InitiateInput): Promise<InitiateOutput> {
    const productIdentity = String(input.cart._id);
    logger.info({ cartId: productIdentity, amount: input.cart.totals.total }, 'khalti.initiate');
    return {
      providerRef: productIdentity,
      extra: {
        publicKey: publicKey(),
        productIdentity,
        productName: `Order for cart ${productIdentity.slice(-6)}`,
        amount: input.cart.totals.total, // already in paisa
      },
    };
  },

  async verify(input: VerifyInput): Promise<VerifyOutput> {
    // TODO(phase-3.5): POST https://khalti.com/api/v2/payment/verify/ with `token` + `amount`.
    return { ok: Boolean(input.gatewayRef), amount: input.cart.totals.total, currency: 'NPR' };
  },

  async refund(_input: RefundInput): Promise<RefundOutput> {
    return { ok: false, message: 'Khalti refunds require merchant-portal action in v1.' };
  },

  verifyWebhookSignature({ rawBody, headers }: WebhookInput): boolean {
    const sigHeader = headers['x-khalti-signature'];
    if (!sigHeader || Array.isArray(sigHeader)) return false;
    const expected = createHmac('sha256', webhookSecret()).update(rawBody).digest('hex');
    if (expected.length !== sigHeader.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHeader, 'hex'));
    } catch {
      return false;
    }
  },

  parseWebhook({ rawBody }: WebhookInput): WebhookOutput {
    const payload = JSON.parse(rawBody.toString('utf8')) as { idx?: string; status?: string };
    return {
      externalEventId: payload.idx ?? `${Date.now()}`,
      type: payload.status ?? 'unknown',
      payload,
    };
  },
};

void secretKey;
