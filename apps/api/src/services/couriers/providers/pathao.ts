import { createHmac, timingSafeEqual } from 'node:crypto';

import type { CourierProvider, ScanEvent } from './types.js';

/**
 * Pathao adapter. Webhook signature: `Authorization: Bearer <secret>` plus
 * `X-Pathao-Signature: <hmac-sha256(rawBody, secret)>` (D-0012).
 */
export const pathaoProvider: CourierProvider = {
  code: 'pathao',
  displayName: 'Pathao Courier',

  trackingUrl(trackingNumber: string): string {
    return `https://merchant.pathao.com/tracking/${trackingNumber}`;
  },

  verifyWebhookSignature({ rawBody, headers, sharedSecret }): boolean {
    const sig = headers['x-pathao-signature'];
    if (!sig || Array.isArray(sig)) return false;
    const bearer = headers.authorization;
    if (typeof bearer !== 'string' || !bearer.startsWith('Bearer ')) return false;
    if (bearer.slice('Bearer '.length).trim() !== sharedSecret) return false;
    const expected = createHmac('sha256', sharedSecret).update(rawBody).digest('hex');
    if (expected.length !== sig.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
    } catch {
      return false;
    }
  },

  parseScanEvent({ rawBody }): ScanEvent[] {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      consignment_id?: string;
      order_status?: string;
      updated_at?: string;
      location?: string;
      events?: Array<{ status?: string; location?: string; ts?: string }>;
    };
    if (Array.isArray(payload.events)) {
      return payload.events.map((e) => ({
        status: e.status ?? payload.order_status ?? 'unknown',
        location: e.location,
        ts: e.ts ? new Date(e.ts) : new Date(),
        trackingNumber: payload.consignment_id ?? '',
        delivered: (e.status ?? payload.order_status ?? '').toLowerCase().includes('delivered'),
      }));
    }
    return [
      {
        status: payload.order_status ?? 'unknown',
        location: payload.location,
        ts: payload.updated_at ? new Date(payload.updated_at) : new Date(),
        trackingNumber: payload.consignment_id ?? '',
        delivered: (payload.order_status ?? '').toLowerCase().includes('delivered'),
      },
    ];
  },
};
