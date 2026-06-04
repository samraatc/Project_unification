import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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
 * eSewa adapter — signed redirect flow.
 *
 * `initiate` builds the signed form-post URL the storefront redirects the
 * customer to. eSewa returns the customer to `/checkout/return?ref=<txn>`,
 * and the storefront calls `verify` to confirm.
 */

function merchantId(): string {
  return process.env.ESEWA_MERCHANT_ID ?? 'EPAYTEST';
}

function secretKey(): string {
  return process.env.ESEWA_SECRET_KEY ?? '8gBm/:&EnhH.1/q';
}

function gatewayUrl(): string {
  return process.env.ESEWA_GATEWAY_URL ?? 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
}

function sign(message: string): string {
  return createHmac('sha256', secretKey()).update(message).digest('base64');
}

export const esewaGateway: PaymentGateway = {
  method: 'esewa',

  async initiate(input: InitiateInput): Promise<InitiateOutput> {
    const txnRef = `${Date.now()}-${String(input.cart._id).slice(-6)}`;
    const amount = (input.cart.totals.total / 100).toFixed(2); // NPR major units
    const message = `total_amount=${amount},transaction_uuid=${txnRef},product_code=${merchantId()}`;
    const signature = sign(message);
    logger.info({ txnRef, amount }, 'esewa.initiate');
    return {
      providerRef: txnRef,
      redirectUrl: gatewayUrl(),
      extra: {
        amount,
        product_code: merchantId(),
        transaction_uuid: txnRef,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature,
      },
    };
  },

  async verify(input: VerifyInput): Promise<VerifyOutput> {
    // TODO(phase-3.5): GET https://rc-epay.esewa.com.np/api/epay/transaction/status/?product_code=…&transaction_uuid=…
    // For dev, accept any non-empty gatewayRef.
    return { ok: Boolean(input.gatewayRef), amount: input.cart.totals.total, currency: 'NPR' };
  },

  async refund(_input: RefundInput): Promise<RefundOutput> {
    // eSewa refund is a manual process via merchant portal in v1; surface as queued.
    return { ok: false, message: 'eSewa refunds are processed via the merchant portal (manual).' };
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

  parseWebhook({ rawBody }: WebhookInput): WebhookOutput {
    const payload = JSON.parse(rawBody.toString('utf8')) as { transaction_uuid?: string; status?: string };
    return {
      externalEventId: payload.transaction_uuid ?? `${Date.now()}`,
      type: payload.status ?? 'unknown',
      payload,
    };
  },
};
