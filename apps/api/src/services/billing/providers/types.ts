/**
 * BillingProvider — D-0003 co-equal Stripe + eSewa + Khalti recurring contract.
 *
 * Distinct from `PaymentGateway` because subscriptions are stateful: providers
 * own the recurring schedule, dunning attempts, and proration. The interface
 * surfaces the small set of mutations the platform needs (`createCheckout`,
 * `retryPayment`, `cancel`) plus signed webhooks for state syncs.
 */

import type { PlanDefinition } from '../plans.js';

export type BillingProviderCode = 'stripe' | 'esewa' | 'khalti';

export interface CreateCheckoutInput {
  tenantId: string;
  plan: PlanDefinition;
  customer: { email?: string; phone?: string; name?: string };
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutHandoff {
  /** Where to redirect the customer next (Stripe Checkout, eSewa redirect…). */
  redirectUrl?: string;
  /** Tokens the storefront SPA needs for inline flows (Khalti). */
  extra?: Record<string, unknown>;
  /** Provider IDs persisted on the subscription. */
  customerRef?: string;
  subscriptionRef?: string;
}

export interface RetryPaymentInput {
  customerRef?: string;
  subscriptionRef?: string;
  amountMinor: number;
  currency: string;
}

export interface RetryPaymentResult {
  ok: boolean;
  attempt: number;
  message?: string;
}

export interface CancelInput {
  customerRef?: string;
  subscriptionRef?: string;
  reason?: string;
}

export interface WebhookInput {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export interface WebhookEvent {
  externalEventId: string;
  type:
    | 'subscription.created'
    | 'subscription.renewed'
    | 'subscription.cancelled'
    | 'subscription.payment_failed'
    | 'subscription.payment_succeeded'
    | 'unknown';
  subscriptionRef?: string;
  amountMinor?: number;
  currency?: string;
  payload: unknown;
}

export interface BillingProvider {
  readonly code: BillingProviderCode;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandoff>;
  retryPayment(input: RetryPaymentInput): Promise<RetryPaymentResult>;
  cancel(input: CancelInput): Promise<void>;
  verifyWebhookSignature(input: WebhookInput): boolean;
  parseWebhook(input: WebhookInput): WebhookEvent;
}
