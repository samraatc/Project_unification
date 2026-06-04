/**
 * Notifications dispatcher.
 *
 * Polls `notificationOutbox` for `pending` rows, dispatches via the matching
 * channel adapter, and updates `status` + `attempts` accordingly. Per-channel
 * opt-out (PRD §3.4) is enforced here so a preference flip during the queue
 * window still takes effect.
 */
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';
import type { Logger } from 'pino';
import { Queue, QueueScheduler } from 'bullmq';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { NotificationOutbox, User } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { channelFor } from '../../../api/src/services/notifications/channels/index.js';

import { env } from '../config.js';

const QUEUE_NAME = 'notifications-dispatch';

interface JobPayload {
  outboxId: string;
}

const MAX_ATTEMPTS = 6;

export function startNotificationsDispatchWorker(redis: IORedis, logger: Logger): Worker {
  // Lightweight scheduler that re-enqueues `pending` rows every 5s.
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- BullMQ requires the scheduler instance to exist
  const _scheduler: QueueScheduler | undefined = (() => {
    try {
      return new QueueScheduler(QUEUE_NAME, { connection: redis });
    } catch {
      return undefined;
    }
  })();

  const poller = setInterval(() => {
    void (async () => {
      const rows = await NotificationOutbox.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(50).select('_id');
      for (const row of rows) {
        await queue.add('send', { outboxId: String(row._id) } satisfies JobPayload, {
          jobId: `outbox:${row._id}`,
        });
      }
    })().catch((err) => logger.error({ err }, 'notifications poll failed'));
  }, 5_000);
  poller.unref();

  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job) => {
      const row = await NotificationOutbox.findById(job.data.outboxId);
      if (!row || row.status !== 'pending') return { skipped: true };

      row.status = 'sending';
      row.attempts = (row.attempts ?? 0) + 1;
      await row.save();

      // Per-channel opt-out check.
      if (row.toUserId) {
        const user = await User.findById(row.toUserId).select('preferences.notifications').lean();
        const prefs = user?.preferences?.notifications ?? { email: true, sms: true, push: true };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose lean
        if (prefs && (prefs as any)[row.channel] === false) {
          row.status = 'suppressed';
          row.suppressedReason = 'user_opt_out';
          await row.save();
          return { suppressed: true };
        }
      }

      if (!row.toAddress) {
        row.status = 'failed';
        row.lastError = 'no_address';
        await row.save();
        return { failed: true };
      }

      const channel = channelFor(row.channel);
      const result = await channel.send({
        to: row.toAddress,
        template: row.template,
        payload: row.payload as Record<string, unknown>,
      });
      if (result.ok) {
        row.status = 'sent';
        row.sentAt = new Date();
        await row.save();
        return { sent: true, providerMessageId: result.providerMessageId };
      }
      row.lastError = result.error;
      row.status = row.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await row.save();
      return { ok: false };
    },
    { connection: redis, concurrency: env.WORKER_CONCURRENCY },
  );

  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'notification dispatch failed'));
  return worker;
}
