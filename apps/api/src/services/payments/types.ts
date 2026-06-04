/**
 * PaymentGateway contract — every payment provider implements the same shape so
 * the checkout + webhook layers don't grow per-provider branches.
 *
 * `initiate` is called when the customer reaches the Payment step; the returned
 * payload tells the storefront how to proceed (Stripe `clientSecret`, eSewa
 * signed redirect URL, Khalti `productIdentity`, PayPal approval link, or COD
 * confirm).
 *
 * `verify` is called after the customer returns (or the webhook fires) to
 * confirm the transaction. `refund` is invoked when an order is refunded.
 * `handleWebhook` is the entry point for the dedicated webhook service.
 */

import type { CartDoc, CheckoutSessionDoc } from '../../db/models/index.js';

export type PaymentMethod = 'stripe' | 'esewa' | 'khalti' | 'paypal' | 'cod';

export interface InitiateInput {
  cart: CartDoc;
  session: CheckoutSessionDoc;
}

export interface InitiateOutput {
  /** Provider-side reference (e.g. PaymentIntent id, eSewa product code). */
  providerRef?: string;
  /** Stripe-style client secret returned to the SPA for `confirmCardPayment`. */
  clientSecret?: string;
  /** Redirect URL for eSewa/PayPal flows. */
  redirectUrl?: string;
  /** Provider-specific payload the storefront needs to render its widget. */
  extra?: Record<string, unknown>;
}

export interface VerifyInput {
  cart: CartDoc;
  session: CheckoutSessionDoc;
  gatewayRef: string;
}

export interface VerifyOutput {
  ok: boolean;
  message?: string;
  amount?: number;
  currency?: string;
}

export interface RefundInput {
  orderId: string;
  gatewayRef: string;
  amount: number;
  currency: string;
}

export interface RefundOutput {
  ok: boolean;
  providerRefundId?: string;
  message?: string;
}

export interface WebhookInput {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export interface WebhookOutput {
  /** Set to a provider-unique event id; the dedupe table uses (provider, externalEventId). */
  externalEventId: string;
  type: string;
  payload: unknown;
}

export interface PaymentGateway {
  readonly method: PaymentMethod;
  initiate(input: InitiateInput): Promise<InitiateOutput>;
  verify(input: VerifyInput): Promise<VerifyOutput>;
  refund(input: RefundInput): Promise<RefundOutput>;
  verifyWebhookSignature(input: WebhookInput): boolean;
  parseWebhook(input: WebhookInput): WebhookOutput;
}
