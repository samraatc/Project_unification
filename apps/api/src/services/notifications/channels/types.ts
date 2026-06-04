/**
 * NotificationChannel — every transport (email, SMS, push) implements this.
 * The dispatcher (in `apps/worker`) picks the adapter per row and calls `send()`.
 */

export type ChannelKind = 'email' | 'sms' | 'push';

export interface SendInput {
  to: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationChannel {
  readonly kind: ChannelKind;
  /** Provider name (sendgrid, twilio, sparrow, fcm). Used by D-0010 routing. */
  readonly provider: string;
  send(input: SendInput): Promise<SendResult>;
}
