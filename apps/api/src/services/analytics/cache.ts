import { createHash } from 'node:crypto';

import { redis } from '../../infra/redis.js';

/**
 * Analytics response cache — D-0015.
 *
 * Keys are `analytics:<endpoint>:<tenantId>:<sha256(queryString)>`. 5-minute
 * TTL is the v1 staleness window; event-driven invalidation lives in Phase 7.
 */

const TTL_SECONDS = 5 * 60;

function key(endpoint: string, tenantId: string, query: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(query ?? {})).digest('hex').slice(0, 16);
  return `analytics:${endpoint}:${tenantId}:${hash}`;
}

export async function cached<T>(
  endpoint: string,
  tenantId: string,
  query: unknown,
  loader: () => Promise<T>,
): Promise<T> {
  const k = key(endpoint, tenantId, query);
  const hit = await redis.get(k);
  if (hit) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // fall through and recompute
    }
  }
  const result = await loader();
  await redis.set(k, JSON.stringify(result), 'EX', TTL_SECONDS);
  return result;
}

export async function invalidateAnalytics(endpoint: string, tenantId: string): Promise<void> {
  const pattern = `analytics:${endpoint}:${tenantId}:*`;
  const stream = redis.scanStream({ match: pattern, count: 100 });
  for await (const keys of stream) {
    if ((keys as string[]).length) await redis.del(...(keys as string[]));
  }
}
