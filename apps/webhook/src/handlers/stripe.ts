import type { Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Order, PaymentEvent } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { stripeGateway } from '../../../api/src/services/payments/stripe.gateway.js';

export const stripeWebhook: RequestHandler = async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
  if (!stripeGateway.verifyWebhookSignature({ rawBody, headers: req.headers })) {
    res.status(401).send('Invalid signature');
    return;
  }
  const evt = stripeGateway.parseWebhook({ rawBody, headers: req.headers });
  try {
    await PaymentEvent.create({
      provider: 'stripe',
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

  if (evt.type === 'payment_intent.succeeded') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (evt.payload as any)?.data?.object as { id?: string } | undefined;
    if (data?.id) {
      await Order.updateOne(
        { 'payment.gatewayRef': data.id },
        { $set: { 'payment.status': 'paid', 'payment.paidAt': new Date() } },
      );
    }
  }
};
