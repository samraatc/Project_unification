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

/** Stripe Billing — Phase 6 ships the contract + dev stub. */
function webhookSecret(): string {
  return process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? 'whsec_billing_dev';
}

export const stripeBilling: BillingProvider = {
  code: 'stripe',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandoff> {
    // TODO(phase-6.1 follow-up): stripe.checkout.sessions.create({ mode: 'subscription' }).
    const sessionId = `cs_dev_${Date.now()}`;
    logger.info({ tenantId: input.tenantId, plan: input.plan.code }, 'stripeBilling.createCheckout');
    return {
      redirectUrl: `https://checkout.stripe.com/c/dev/${sessionId}`,
      customerRef: `cus_dev_${input.tenantId.slice(-8)}`,
      subscriptionRef: sessionId,
    };
  },

  async retryPayment(_input: RetryPaymentInput): Promise<RetryPaymentResult> {
    // TODO(phase-6.1 follow-up): stripe.invoices.pay(invoiceId).
    return { ok: true, attempt: 1 };
  },

  async cancel(input: CancelInput): Promise<void> {
    logger.info({ subscriptionRef: input.subscriptionRef }, 'stripeBilling.cancel');
    // TODO(phase-6.1 follow-up): stripe.subscriptions.update(id, { cancel_at_period_end: true }).
  },

  verifyWebhookSignature({ rawBody, headers }: WebhookInput): boolean {
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

  parseWebhook({ rawBody }: WebhookInput): WebhookEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      id?: string;
      type?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stripe shape
      data?: { object?: any };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stripe shape
    const obj: any = payload.data?.object ?? {};
    let type: WebhookEvent['type'] = 'unknown';
    switch (payload.type) {
      case 'customer.subscription.created':
        type = 'subscription.created';
        break;
      case 'customer.subscription.deleted':
        type = 'subscription.cancelled';
        break;
      case 'invoice.payment_succeeded':
        type = 'subscription.payment_succeeded';
        break;
      case 'invoice.payment_failed':
        type = 'subscription.payment_failed';
        break;
      case 'customer.subscription.updated':
        type = 'subscription.renewed';
        break;
    }
    return {
      externalEventId: payload.id ?? `evt_${Date.now()}`,
      type,
      subscriptionRef: obj.subscription ?? obj.id,
      amountMinor: obj.amount_paid ?? obj.amount_due,
      currency: obj.currency,
      payload,
    };
  },
};
