import 'dotenv/config';

import mongoose from 'mongoose';
import IORedis from 'ioredis';
import pino from 'pino';

import { env } from './config.js';
import { startAbandonedCheckoutWorker } from './queues/abandonedCheckout.worker.js';
import { startNotificationsDispatchWorker } from './queues/notificationsDispatch.worker.js';
import { startSocialPublishWorker } from './queues/socialPublish.worker.js';

const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'worker', env: env.NODE_ENV },
});

async function main(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const workers = [
    startSocialPublishWorker(redis, logger),
    startAbandonedCheckoutWorker(redis, logger),
    startNotificationsDispatchWorker(redis, logger),
  ];

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker shutdown received');
    await Promise.allSettled(workers.map((w) => w.close()));
    await mongoose.disconnect();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  logger.info({ workers: workers.length, concurrency: env.WORKER_CONCURRENCY }, 'worker ready');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal worker startup error:', err);
  process.exit(1);
});
