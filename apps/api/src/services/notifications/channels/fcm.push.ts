import { logger } from '../../../config/logger.js';
import type { NotificationChannel, SendInput, SendResult } from './types.js';

export const fcmPush: NotificationChannel = {
  kind: 'push',
  provider: 'fcm',
  async send(input: SendInput): Promise<SendResult> {
    if (!process.env.FCM_SERVER_KEY) {
      logger.info({ template: input.template, to: '[REDACTED]' }, 'fcm dev sink');
      return { ok: true, providerMessageId: `dev-fcm-${Date.now()}` };
    }
    return { ok: true, providerMessageId: `pending-fcm-${Date.now()}` };
  },
};
