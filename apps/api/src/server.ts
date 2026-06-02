import 'dotenv/config';

import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { connectMongo, disconnectMongo } from './infra/mongo.js';
import { connectRedis, disconnectRedis } from './infra/redis.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = createApp();

  await Promise.all([connectMongo(), connectRedis()]);

  const server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'api listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutdown received');
    server.close(async () => {
      await disconnectMongo().catch((err) => logger.error({ err }, 'mongo disconnect failed'));
      await disconnectRedis().catch((err) => logger.error({ err }, 'redis disconnect failed'));
      process.exit(0);
    });
    // TRD §5 — drain in-flight requests up to 30s.
    setTimeout(() => process.exit(1), 30_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
