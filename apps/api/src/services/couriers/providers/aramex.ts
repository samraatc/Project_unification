import { createHmac, timingSafeEqual } from 'node:crypto';

import type { CourierProvider, ScanEvent } from './types.js';

/**
 * Aramex adapter. Webhook signature: `X-Aramex-Signature: sha256=<hmac>` over
 * the raw body, secret rotated via admin UI.
 */
export const aramexProvider: CourierProvider = {
  code: 'aramex',
  displayName: 'Aramex',

  trackingUrl(trackingNumber: string): string {
    return `https://www.aramex.com/track/results?mode=0&ShipmentNumber=${trackingNumber}`;
  },

  verifyWebhookSignature({ rawBody, headers, sharedSecret }): boolean {
    const sig = headers['x-aramex-signature'];
    if (!sig || Array.isArray(sig)) return false;
    const [scheme, presented] = sig.split('=');
    if (scheme !== 'sha256' || !presented) return false;
    const expected = createHmac('sha256', sharedSecret).update(rawBody).digest('hex');
    if (expected.length !== presented.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(presented, 'hex'));
    } catch {
      return false;
    }
  },

  parseScanEvent({ rawBody }): ScanEvent[] {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      ShipmentNumber?: string;
      TrackingResults?: Array<{
        UpdateCode?: string;
        UpdateDescription?: string;
        UpdateLocation?: string;
        UpdateDateTime?: string;
      }>;
    };
    if (!payload.TrackingResults?.length) {
      return [];
    }
    return payload.TrackingResults.map((r) => ({
      status: r.UpdateDescription ?? r.UpdateCode ?? 'unknown',
      location: r.UpdateLocation,
      ts: r.UpdateDateTime ? new Date(r.UpdateDateTime) : new Date(),
      trackingNumber: payload.ShipmentNumber ?? '',
      delivered: (r.UpdateCode ?? '').toUpperCase() === 'SH005',
    }));
  },
};
