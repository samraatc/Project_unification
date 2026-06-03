import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';

/**
 * Notification dispatcher — Phase 0 implementation logs to the console.
 *
 * Phase 4 replaces the body with a BullMQ enqueue against the `notificationOutbox`
 * collection (Database.md §9.2) and a worker that fans out to SendGrid / Twilio /
 * Sparrow SMS / FCM with delivery tracking.
 */
const env = loadEnv();

export interface EmailMessage {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    logger.info({ kind: 'email.dev', ...msg }, 'email dispatched (dev sink)');
    return;
  }
  // TODO(phase-4): enqueue to BullMQ `notifications` queue.
  logger.warn({ msg }, 'sendEmail called outside dev — wire BullMQ in Phase 4');
}

export interface SmsMessage {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

export async function sendSms(msg: SmsMessage): Promise<void> {
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    logger.info({ kind: 'sms.dev', ...msg }, 'sms dispatched (dev sink)');
    return;
  }
  logger.warn({ msg }, 'sendSms called outside dev — wire BullMQ in Phase 4');
}
