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

/** Cash-on-Delivery — no gateway hop; the order is "confirmed" but payment stays `pending` until courier handoff. */
export const codGateway: PaymentGateway = {
  method: 'cod',

  async initiate(_input: InitiateInput): Promise<InitiateOutput> {
    return { providerRef: `cod-${Date.now()}` };
  },

  async verify(_input: VerifyInput): Promise<VerifyOutput> {
    return { ok: true };
  },

  async refund(_input: RefundInput): Promise<RefundOutput> {
    return { ok: true, message: 'COD refund handled offline.' };
  },

  verifyWebhookSignature(_input: WebhookInput): boolean {
    return true; // COD has no webhook
  },

  parseWebhook(_input: WebhookInput): WebhookOutput {
    return { externalEventId: `cod-${Date.now()}`, type: 'noop', payload: {} };
  },
};
