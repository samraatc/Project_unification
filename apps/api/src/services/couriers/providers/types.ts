/**
 * Courier provider contract.
 *
 * One file per provider — Pathao + Aramex in v1. The webhook service routes
 * inbound payloads through `verifyWebhookSignature` → `parseScanEvent` so the
 * core `orders.shipping.scanEvents` updater is provider-agnostic.
 */

export type CourierCode = 'pathao' | 'aramex';

export interface ScanEvent {
  status: string;
  location?: string;
  ts: Date;
  /** External tracking number from the courier. */
  trackingNumber: string;
  /** Optional terminal-state hint so we can also flip the order to `delivered`. */
  delivered?: boolean;
}

export interface CourierProvider {
  readonly code: CourierCode;
  readonly displayName: string;

  trackingUrl(trackingNumber: string): string;

  verifyWebhookSignature(args: {
    rawBody: Buffer;
    headers: Record<string, string | string[] | undefined>;
    sharedSecret: string;
  }): boolean;

  parseScanEvent(args: { rawBody: Buffer }): ScanEvent[];
}
