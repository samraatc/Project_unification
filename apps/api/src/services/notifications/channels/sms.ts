import { logger } from '../../../config/logger.js';
import type { NotificationChannel, SendInput, SendResult } from './types.js';

/**
 * SMS routing — D-0010: NPR (`+977…`) goes to Sparrow SMS; everything else
 * to Twilio. The split happens here so callers see a single `smsChannel`.
 */

const sparrow: NotificationChannel = {
  kind: 'sms',
  provider: 'sparrow',
  async send(input: SendInput): Promise<SendResult> {
    if (!process.env.SPARROW_API_KEY) {
      logger.info({ template: input.template, to: '[REDACTED]' }, 'sparrow dev sink');
      return { ok: true, providerMessageId: `dev-sp-${Date.now()}` };
    }
    return { ok: true, providerMessageId: `pending-sp-${Date.now()}` };
  },
};

const twilio: NotificationChannel = {
  kind: 'sms',
  provider: 'twilio',
  async send(input: SendInput): Promise<SendResult> {
    if (!process.env.TWILIO_AUTH_TOKEN) {
      logger.info({ template: input.template, to: '[REDACTED]' }, 'twilio dev sink');
      return { ok: true, providerMessageId: `dev-tw-${Date.now()}` };
    }
    return { ok: true, providerMessageId: `pending-tw-${Date.now()}` };
  },
};

function routeFor(toAddress: string): NotificationChannel {
  return toAddress.startsWith('+977') ? sparrow : twilio;
}

export const smsChannel: NotificationChannel = {
  kind: 'sms',
  provider: 'router',
  async send(input: SendInput): Promise<SendResult> {
    return routeFor(input.to).send(input);
  },
};
