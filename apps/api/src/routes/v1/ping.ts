import { Router } from 'express';

export const pingRouter: Router = Router();

/**
 * Smoke endpoint used by Sprint 0 staging-deploy exit gate (Roadmap.md Phase 0).
 */
pingRouter.get('/ping', (_req, res) => {
  res.status(200).json({
    pong: true,
    service: 'api',
    version: process.env.npm_package_version ?? '0.0.0',
    ts: new Date().toISOString(),
  });
});
