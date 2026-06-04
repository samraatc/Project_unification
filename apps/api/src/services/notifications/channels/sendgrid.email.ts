import { logger } from '../../../config/logger.js';
import type { NotificationChannel, SendInput, SendResult } from './types.js';

/**
 * SendGrid email adapter (TRD §1).
 *
 * Phase 4.4 ships the contract + dev sink so the outbox dispatcher round-trips
 * without an API key. Real HTTP `https://api.sendgrid.com/v3/mail/send` lands
 * with the Phase 4.4 follow-up when `SENDGRID_API_KEY` is provisioned in Vault.
 */
export const sendgridEmail: NotificationChannel = {
  kind: 'email',
  provider: 'sendgrid',
  async send(input: SendInput): Promise<SendResult> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info({ template: input.template, to: '[REDACTED]' }, 'sendgrid dev sink');
      return { ok: true, providerMessageId: `dev-sg-${Date.now()}` };
    }
    // TODO(phase-4.4): real `fetch('https://api.sendgrid.com/v3/mail/send', …)`.
    return { ok: true, providerMessageId: `pending-sg-${Date.now()}` };
  },
};
