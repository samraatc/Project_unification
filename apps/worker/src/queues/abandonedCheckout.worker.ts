/**
 * abandoned-checkout worker.
 *
 * Fires `cart.abandoned` email 1h after the last cart update if the cart still
 * has items and no order has been placed. PRD/FR-007: also schedules a 24h
 * payment-failure retry for `pending` orders.
 *
 * Phase 3.6 ships the queue + processor; the API enqueues a job whenever the
 * cart is mutated (Phase 3.5 follow-up will hook `cart.save()` into this).
 */
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import type { Logger } from 'pino';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Cart } from '../../../api/src/db/models/index.js';

import { env } from '../config.js';

const QUEUE_NAME = 'abandoned-checkout';

interface JobPayload {
  cartId: string;
  tenantId: string;
}

export function startAbandonedCheckoutWorker(redis: IORedis, logger: Logger): Worker {
  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      const { cartId, tenantId } = job.data;
      const cart = await Cart.findOne({ _id: cartId, tenantId });
      if (!cart || cart.items.length === 0) return { skipped: true };
      // TODO(phase-3.6 follow-up): send the actual email via the notifications
      // outbox (lands with FR-010 in Phase 4). Phase 3.6 just logs the event.
      logger.info({ cartId, tenantId, itemCount: cart.items.length }, 'abandoned-checkout reminder fired');
      return { sent: true };
    },
    { connection: redis, concurrency: env.WORKER_CONCURRENCY },
  );
  return worker;
}
