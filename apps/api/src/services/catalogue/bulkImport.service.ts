import { Queue } from 'bullmq';

import { redis } from '../../infra/redis.js';

/**
 * Bulk CSV import.
 *
 * The route accepts the upload and immediately enqueues a job. The worker
 * (Phase 3.1 follow-up) streams the CSV, upserts each row by SKU (idempotent),
 * and writes a progress hash back to Redis under `import:<jobId>`.
 *
 * Expected columns: sku,name,slug,brand,categories,basePrice,salePrice,currency,
 *                   stock,imageUrl,attributes_json
 */

export const IMPORT_QUEUE = 'catalogue-import';

const queue = new Queue(IMPORT_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 7 * 24 * 3600 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
});

export interface EnqueueImportInput {
  tenantId: string;
  actorId: string;
  s3Key: string;
  filename: string;
}

export async function enqueueBulkImport(input: EnqueueImportInput): Promise<{ jobId: string }> {
  const job = await queue.add('csv', input);
  await redis.hset(`import:${job.id}`, {
    status: 'queued',
    filename: input.filename,
    rowsTotal: 0,
    rowsProcessed: 0,
    rowsFailed: 0,
    startedAt: '',
    finishedAt: '',
  });
  return { jobId: String(job.id) };
}

export async function getImportProgress(jobId: string): Promise<Record<string, string>> {
  return (await redis.hgetall(`import:${jobId}`)) as Record<string, string>;
}
