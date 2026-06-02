import { Router } from 'express';
import mongoose from 'mongoose';

import { redis } from '../infra/redis.js';

export const healthRouter: Router = Router();

/**
 * Kubernetes liveness probe — process is alive (TRD §5).
 */
healthRouter.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

/**
 * Kubernetes readiness probe — dependencies reachable.
 */
healthRouter.get('/readyz', async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    redisOk = (await redis.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }
  const status = mongoOk && redisOk ? 200 : 503;
  res.status(status).json({
    status: status === 200 ? 'ready' : 'degraded',
    checks: { mongo: mongoOk, redis: redisOk },
  });
});
