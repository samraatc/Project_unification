/**
 * social-publish worker.
 *
 * Consumes from the BullMQ queue created in `apps/api`. For each scheduled post,
 * fan out per target using the platform provider's `publish()` method. Failed
 * targets are recorded on the post document; the queue retries with exponential
 * backoff (configured at enqueue time).
 */
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import type { Logger } from 'pino';
import mongoose from 'mongoose';

// Reach into apps/api for the Mongoose models + provider registry. In production
// these would live in a shared `@unified/domain` package; the cross-app import
// here is intentional for Phase 2 to keep the surface small.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Post, SocialAccount } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { providerFor, type Platform } from '../../../api/src/services/social/providers/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { decryptField } from '../../../api/src/services/crypto.service.js';

import { env } from '../config.js';

const QUEUE_NAME = 'social-publish';

interface JobPayload {
  postId: string;
  tenantId: string;
}

export function startSocialPublishWorker(redis: IORedis, logger: Logger): Worker {
  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      const { postId, tenantId } = job.data;
      const post = await Post.findOne({ _id: postId, tenantId });
      if (!post) throw new Error(`Post ${postId} not found`);
      if (post.status === 'published') return { skipped: true };

      post.status = 'publishing';
      await post.save();

      let succeeded = 0;
      let failed = 0;
      for (let i = 0; i < post.targets.length; i++) {
        const target = post.targets[i]!;
        if (target.status === 'published') continue;
        // eslint-disable-next-line no-await-in-loop -- fan-out is small (≤3 platforms typically)
        const account = await SocialAccount.findById(target.socialAccountId).select(
          '+oauth.accessTokenCipher externalAccountId platform',
        );
        if (!account || !account.oauth?.accessTokenCipher) {
          target.status = 'failed';
          target.error = 'account-disconnected';
          failed++;
          continue;
        }
        try {
          const provider = providerFor(account.platform as Platform);
          // eslint-disable-next-line no-await-in-loop
          const result = await provider.publish({
            accessToken: decryptField(account.oauth.accessTokenCipher),
            externalAccountId: account.externalAccountId,
            payload: {
              caption: target.overrides?.caption ?? post.content,
              hashtags: target.overrides?.hashtags ?? [],
              mediaUrls: (target.overrides?.mediaKeys ?? post.mediaKeys ?? []).map(keyToPublicUrl),
              firstComment: target.overrides?.firstComment,
            },
          });
          target.externalPostId = result.externalPostId;
          target.publishedAt = result.publishedAt;
          target.status = 'published';
          target.error = undefined as unknown as string;
          succeeded++;
        } catch (err) {
          target.status = 'failed';
          target.error = err instanceof Error ? err.message : String(err);
          failed++;
          logger.error({ err, postId, accountId: String(account._id) }, 'social publish target failed');
        }
      }

      // Post is published iff every target succeeded; partial failures keep it in
      // `publishing` so a retry can revisit only the failed targets.
      if (failed === 0) {
        post.status = 'published';
        post.publishedAt = new Date();
      } else if (succeeded === 0) {
        post.status = 'failed';
      } else {
        post.status = 'publishing';
      }
      await post.save();
      return { succeeded, failed };
    },
    {
      connection: redis,
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'social publish job completed');
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'social publish job failed');
  });

  return worker;
}

function keyToPublicUrl(key: string): string {
  const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  const bucket = process.env.S3_BUCKET ?? 'unified-dev';
  return `${endpoint}/${bucket}/${key}`;
}

void mongoose; // ensure the workspace package registers models
