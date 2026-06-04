import { createHash, timingSafeEqual } from 'node:crypto';

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

/**
 * eSewa Recurring (mandate-based) — Phase 6 contract + dev stub.
 *
 * eSewa's recurring product hands the customer a signed redirect to authorise a
 * mandate; we store the mandate ref and trigger charges via their server-side
 * API on each cycle.
 */
function secretKey(): string {
  return process.env.ESEWA_RECURRING_SECRET ?? 'esewa-recurring-dev-secret';
}

export const esewaRecurring: BillingProvider = {
  code: 'esewa',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandoff> {
    const txn = `esw-rec-${Date.now()}-${input.tenantId.slice(-6)}`;
    logger.info({ tenantId: input.tenantId, plan: input.plan.code }, 'esewaRecurring.createCheckout');
    return {
      redirectUrl: `${process.env.ESEWA_RECURRING_URL ?? 'https://rc-epay.esewa.com.np/api/mandate/v1/init'}?ref=${txn}`,
      customerRef: `esw-cust-${input.tenantId}`,
      subscriptionRef: txn,
    };
  },

  async retryPayment(_input: RetryPaymentInput): Promise<RetryPaymentResult> {
    // TODO(phase-6.1 follow-up): POST /mandate/v1/charge with the mandate ref.
    return { ok: true, attempt: 1 };
  },

  async cancel(input: CancelInput): Promise<void> {
    logger.info({ subscriptionRef: input.subscriptionRef }, 'esewaRecurring.cancel');
    // TODO(phase-6.1 follow-up): POST /mandate/v1/cancel.
  },

  verifyWebhookSignature({ rawBody, headers }: WebhookInput): boolean {
    const sigHeader = headers['x-esewa-signature'];
    if (!sigHeader || Array.isArray(sigHeader)) return false;
    const expected = createHash('sha256').update(rawBody.toString('utf8') + secretKey()).digest('hex');
    if (expected.length !== sigHeader.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHeader, 'hex'));
    } catch {
      return false;
    }
  },

  parseWebhook({ rawBody }: WebhookInput): WebhookEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      mandate_id?: string;
      event?: string;
      amount?: number;
    };
    let type: WebhookEvent['type'] = 'unknown';
    switch (payload.event) {
      case 'mandate.created':
        type = 'subscription.created';
        break;
      case 'mandate.charge.success':
        type = 'subscription.payment_succeeded';
        break;
      case 'mandate.charge.failed':
        type = 'subscription.payment_failed';
        break;
      case 'mandate.cancelled':
        type = 'subscription.cancelled';
        break;
    }
    return {
      externalEventId: `${payload.mandate_id ?? Date.now()}-${payload.event ?? 'unknown'}`,
      type,
      subscriptionRef: payload.mandate_id,
      amountMinor: payload.amount ? payload.amount * 100 : undefined,
      currency: 'NPR',
      payload,
    };
  },
};
