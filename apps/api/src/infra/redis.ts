import IORedis from 'ioredis';

import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

const env = loadEnv();

/**
 * Shared ioredis client. Used by sessions, BullMQ, RBAC permission cache,
 * rate limiter (TRD §1). BullMQ requires `maxRetriesPerRequest: null`.
 */
export const redis: IORedis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('error', (err) => logger.error({ err }, 'redis error'));
redis.on('ready', () => logger.info('redis ready'));

export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
