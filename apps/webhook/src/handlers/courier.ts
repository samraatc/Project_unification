import type { Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PaymentEvent } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { courierProvider, type CourierCode } from '../../../api/src/services/couriers/providers/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getCourierSecret, ingestScanEvents } from '../../../api/src/services/couriers/couriers.service.js';

/**
 * Inbound courier webhook router.
 *
 * The webhook service does not yet know the tenant; the courier code is in the
 * URL, and the shared secret is stored per tenant. In v1 single-tenant mode
 * we resolve against the default tenant; multi-tenant deployments will switch
 * to an `X-Tenant-Id` header or a path-prefixed tenant slug.
 */

const DEFAULT_TENANT = '000000000000000000000001';

export function makeCourierHandler(code: CourierCode): RequestHandler {
  return async (req: Request, res: Response) => {
    const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
    const secret = await getCourierSecret(DEFAULT_TENANT, code);
    const provider = courierProvider(code);
    if (!secret || !provider.verifyWebhookSignature({ rawBody, headers: req.headers, sharedSecret: secret })) {
      res.status(401).send('Invalid signature');
      return;
    }

    // Idempotency — derive an event id from the body hash.
    const eventId = `${code}-${Buffer.from(rawBody).toString('base64').slice(0, 24)}`;
    try {
      await PaymentEvent.create({
        provider: code === 'pathao' ? 'pathao' : 'aramex',
        externalEventId: eventId,
        type: 'scan_event',
        payload: JSON.parse(rawBody.toString('utf8')) as unknown,
        receivedAt: new Date(),
      });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose error shape
      if ((err as any)?.code === 11000) {
        res.status(200).send('OK');
        return;
      }
      throw err;
    }
    res.status(200).send('OK');

    const events = provider.parseScanEvent({ rawBody });
    await ingestScanEvents({ tenantId: DEFAULT_TENANT, courierCode: code, events });
  };
}
