import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * OpenAPI source-of-truth. Every Express route registers its Zod schemas here so
 * `pnpm openapi:generate` can emit `openapi.generated.json`, from which
 * packages/sdk builds the TS client (Sprint 0 deliverable #9).
 */
export const registry: OpenAPIRegistry = new OpenAPIRegistry();

// Phase 0 — register the smoke endpoints so the SDK has something to bind to.
const PingResponse = z.object({
  pong: z.literal(true),
  service: z.string(),
  version: z.string(),
  ts: z.string().datetime(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/ping',
  summary: 'Smoke endpoint',
  tags: ['health'],
  responses: {
    200: {
      description: 'Service is up',
      content: { 'application/json': { schema: PingResponse } },
    },
  },
});

const HealthResponse = z.object({
  status: z.string(),
  uptime: z.number().optional(),
  checks: z
    .object({ mongo: z.boolean(), redis: z.boolean() })
    .optional(),
});

registry.registerPath({
  method: 'get',
  path: '/healthz',
  summary: 'Liveness probe',
  tags: ['health'],
  responses: {
    200: { description: 'Alive', content: { 'application/json': { schema: HealthResponse } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/readyz',
  summary: 'Readiness probe',
  tags: ['health'],
  responses: {
    200: { description: 'Ready', content: { 'application/json': { schema: HealthResponse } } },
    503: { description: 'Degraded', content: { 'application/json': { schema: HealthResponse } } },
  },
});

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Unified Platform API',
      version: '0.0.0',
      description:
        'REST contract for the Unified Marketing & E-Commerce Management Platform. Source: zod-to-openapi registry.',
    },
    servers: [{ url: 'http://localhost:4000', description: 'Local dev' }],
  });
}
