import type { Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PaymentEvent } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { billingProviderFor, type BillingProviderCode } from '../../../api/src/services/billing/providers/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ingestBillingEvent } from '../../../api/src/services/billing/billing.service.js';

/**
 * Generic billing-webhook factory. The webhook service mounts one route per
 * provider (`/webhooks/billing/stripe`, `/webhooks/billing/esewa`, `/webhooks/billing/khalti`).
 */
export function makeBillingHandler(provider: BillingProviderCode): RequestHandler {
  return async (req: Request, res: Response) => {
    const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
    const adapter = billingProviderFor(provider);
    if (!adapter.verifyWebhookSignature({ rawBody, headers: req.headers })) {
      res.status(401).send('Invalid signature');
      return;
    }
    const evt = adapter.parseWebhook({ rawBody, headers: req.headers });

    try {
      await PaymentEvent.create({
        provider,
        externalEventId: evt.externalEventId,
        type: evt.type,
        payload: evt.payload,
        receivedAt: new Date(),
      });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 11000) {
        res.status(200).send('OK');
        return;
      }
      throw err;
    }
    res.status(200).send('OK');

    await ingestBillingEvent({
      provider,
      externalEventId: evt.externalEventId,
      type: evt.type,
      subscriptionRef: evt.subscriptionRef,
      amountMinor: evt.amountMinor,
    });
  };
}
