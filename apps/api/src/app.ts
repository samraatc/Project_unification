import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';

import { loadEnv } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { v1Router } from './routes/v1/index.js';
import { wellKnownRouter } from './routes/wellKnown.js';

export function createApp(): Express {
  const env = loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // Request id + structured logging.
  app.use((req, _res, next) => {
    const incoming = req.headers['x-request-id'];
    req.headers['x-request-id'] =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : uuid();
    next();
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => String(req.headers['x-request-id']),
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // Global rate limit. Per-route limits land with auth (Phase 1).
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use('/', healthRouter);
  app.use('/.well-known', wellKnownRouter);
  app.use('/api/v1', v1Router);

  app.use((_req, res) => {
    res.status(404).json({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  app.use(errorHandler);
  return app;
}
