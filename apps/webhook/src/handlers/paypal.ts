import type { Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Order, PaymentEvent } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { paypalGateway } from '../../../api/src/services/payments/paypal.gateway.js';

export const paypalWebhook: RequestHandler = async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
  if (!paypalGateway.verifyWebhookSignature({ rawBody, headers: req.headers })) {
    res.status(401).send('Invalid signature');
    return;
  }
  const evt = paypalGateway.parseWebhook({ rawBody, headers: req.headers });
  try {
    await PaymentEvent.create({
      provider: 'paypal',
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
  if (evt.type === 'CHECKOUT.ORDER.APPROVED' || evt.type === 'PAYMENT.CAPTURE.COMPLETED') {
    await Order.updateOne(
      { 'payment.gatewayRef': evt.externalEventId },
      { $set: { 'payment.status': 'paid', 'payment.paidAt': new Date() } },
    );
  }
};
