import type { Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Order, PaymentEvent } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { esewaGateway } from '../../../api/src/services/payments/esewa.gateway.js';

export const esewaWebhook: RequestHandler = async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
  if (!esewaGateway.verifyWebhookSignature({ rawBody, headers: req.headers })) {
    res.status(401).send('Invalid signature');
    return;
  }
  const evt = esewaGateway.parseWebhook({ rawBody, headers: req.headers });
  try {
    await PaymentEvent.create({
      provider: 'esewa',
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
  if (evt.type === 'COMPLETE') {
    await Order.updateOne(
      { 'payment.gatewayRef': evt.externalEventId },
      { $set: { 'payment.status': 'paid', 'payment.paidAt': new Date() } },
    );
  }
};
