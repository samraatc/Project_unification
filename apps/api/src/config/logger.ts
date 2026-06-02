import pino from 'pino';

import { loadEnv } from './env.js';

const env = loadEnv();

/**
 * Pino logger with the PII redaction list from Logging.md §7.
 * Pretty-print only in development; structured JSON elsewhere for Datadog ingest.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
      'req.body.otp',
      'req.body.totp',
      'req.body.cardNumber',
      'req.body.cvv',
      '*.password',
      '*.passwordHash',
      '*.refreshToken',
      '*.accessToken',
      '*.email',
      '*.phone',
    ],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', singleLine: false },
        },
      }
    : {}),
});

export type Logger = typeof logger;
