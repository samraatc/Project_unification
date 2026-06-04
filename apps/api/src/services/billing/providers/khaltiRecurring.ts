import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../../config/logger.js';
import type {
  BillingProvider,
  CancelInput,
  CheckoutHandoff,
  CreateCheckoutInput,
  RetryPaymentInput,
  RetryPaymentResult,
  WebhookEvent,
  WebhookInput,
} from './types.js';

function webhookSecret(): string {
  return process.env.KHALTI_BILLING_WEBHOOK_SECRET ?? 'khalti-billing-dev';
}

export const khaltiRecurring: BillingProvider = {
  code: 'khalti',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandoff> {
    const ref = `kht-rec-${Date.now()}-${input.tenantId.slice(-6)}`;
    logger.info({ tenantId: input.tenantId, plan: input.plan.code }, 'khaltiRecurring.createCheckout');
    return {
      extra: {
        publicKey: process.env.KHALTI_PUBLIC_KEY ?? 'test_public_key',
        productIdentity: ref,
        productName: `${input.plan.name} subscription`,
        amount: input.plan.amountNpr,
      },
      customerRef: `kht-cust-${input.tenantId}`,
      subscriptionRef: ref,
    };
  },

  async retryPayment(_input: RetryPaymentInput): Promise<RetryPaymentResult> {
    return { ok: true, attempt: 1 };
  },

  async cancel(input: CancelInput): Promise<void> {
    logger.info({ subscriptionRef: input.subscriptionRef }, 'khaltiRecurring.cancel');
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

  parseWebhook({ rawBody }: WebhookInput): WebhookEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      idx?: string;
      event?: string;
      amount?: number;
    };
    let type: WebhookEvent['type'] = 'unknown';
    switch (payload.event) {
      case 'subscription.created':
        type = 'subscription.created';
        break;
      case 'subscription.charged':
        type = 'subscription.payment_succeeded';
        break;
      case 'subscription.failed':
        type = 'subscription.payment_failed';
        break;
      case 'subscription.cancelled':
        type = 'subscription.cancelled';
        break;
    }
    return {
      externalEventId: `${payload.idx ?? Date.now()}-${payload.event ?? 'unknown'}`,
      type,
      subscriptionRef: payload.idx,
      amountMinor: payload.amount,
      currency: 'NPR',
      payload,
    };
  },
};
