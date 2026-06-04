import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';
import pino from 'pino';
import pinoHttp from 'pino-http';

import { env } from './config.js';
import { makeBillingHandler } from './handlers/billing.js';
import { makeCourierHandler } from './handlers/courier.js';
import { esewaWebhook } from './handlers/esewa.js';
import { khaltiWebhook } from './handlers/khalti.js';
import { metaWebhook } from './handlers/meta.js';
import { paypalWebhook } from './handlers/paypal.js';
import { stripeWebhook } from './handlers/stripe.js';
import { tiktokWebhook } from './handlers/tiktok.js';

const logger = pino({ level: 'info', base: { service: 'webhook', env: env.NODE_ENV } });

async function main(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);

  const app = express();
  app.disable('x-powered-by');

  // CRITICAL: use raw body so signature verifiers can HMAC the bytes exactly as sent.
  app.use(express.raw({ type: '*/*', limit: '2mb' }));
  app.use(pinoHttp({ logger }));

  app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'webhook' }));

  app.post('/webhooks/meta', metaWebhook);
  // Meta GET verification handshake.
  app.get('/webhooks/meta', (req, res) => {
    const challenge = String(req.query['hub.challenge'] ?? '');
    const verifyToken = String(req.query['hub.verify_token'] ?? '');
    if (verifyToken === (process.env.META_VERIFY_TOKEN ?? 'dev-verify')) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Verification token mismatch');
    }
  });

  app.post('/webhooks/tiktok', tiktokWebhook);

  // Phase 3 — payment provider webhooks.
  app.post('/webhooks/stripe', stripeWebhook);
  app.post('/webhooks/esewa', esewaWebhook);
  app.post('/webhooks/khalti', khaltiWebhook);
  app.post('/webhooks/paypal', paypalWebhook);

  // Phase 4 — courier scan-event webhooks.
  app.post('/webhooks/pathao', makeCourierHandler('pathao'));
  app.post('/webhooks/aramex', makeCourierHandler('aramex'));

  // Phase 6 — subscription billing webhooks (separate from FR-007 payment webhooks).
  app.post('/webhooks/billing/stripe', makeBillingHandler('stripe'));
  app.post('/webhooks/billing/esewa', makeBillingHandler('esewa'));
  app.post('/webhooks/billing/khalti', makeBillingHandler('khalti'));

  app.use((_req, res) => res.status(404).send('Not Found'));

  const server = app.listen(env.WEBHOOK_PORT, () => {
    logger.info({ port: env.WEBHOOK_PORT }, 'webhook service listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'webhook shutdown received');
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal webhook startup error:', err);
  process.exit(1);
});
