/**
 * Dunning retry worker — Phase 6.1.
 *
 * Ticks every minute and calls `tickDunning()` which walks every `past_due`
 * subscription whose `nextAttemptAt` has elapsed, retries the gateway, and
 * either revives the subscription, schedules the next attempt, or downgrades
 * after 14 days (PRD FR-016).
 */
import type IORedis from 'ioredis';
import type { Logger } from 'pino';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { tickDunning } from '../../../api/src/services/billing/billing.service.js';

export function startDunningRetryWorker(_redis: IORedis, logger: Logger): { close: () => Promise<void> } {
  const interval = setInterval(() => {
    void tickDunning().catch((err) => logger.error({ err }, 'dunning tick failed'));
  }, 60_000);
  interval.unref();
  return {
    async close() {
      clearInterval(interval);
    },
  };
}
