import { Queue } from 'bullmq';

import { redis } from '../../infra/redis.js';
import { Post } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';

/**
 * Scheduler — places a delayed BullMQ job that fires at `scheduledAt`. The
 * worker (`apps/worker`) consumes from this queue and fans out per target.
 *
 * Re-scheduling cancels the prior job (we use `postId` as the BullMQ jobId so
 * re-adding overwrites).
 */

export const PUBLISH_QUEUE_NAME = 'social-publish';

const queue = new Queue(PUBLISH_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
});

export interface ScheduleInput {
  postId: string;
  tenantId: string;
  actorId: string;
  scheduledAt: Date;
  ip?: string;
  ua?: string;
}

export async function schedulePost(input: ScheduleInput): Promise<void> {
  const post = await Post.findOne({ _id: input.postId, tenantId: input.tenantId });
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found.');
  if (post.status === 'published') throw new HttpError(409, 'ALREADY_PUBLISHED', 'Post already published.');
  if (post.status === 'pending_approval') {
    throw new HttpError(409, 'NEEDS_APPROVAL', 'Post requires approval before scheduling.');
  }
  const delay = Math.max(0, input.scheduledAt.getTime() - Date.now());
  await queue.add(
    'publish',
    { postId: String(post._id), tenantId: String(post.tenantId) },
    {
      jobId: `post:${post._id}`,
      delay,
    },
  );
  post.scheduledAt = input.scheduledAt;
  post.status = 'scheduled';
  await post.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.post_scheduled',
    entity: 'Post',
    entityId: post._id,
    afterJson: { scheduledAt: input.scheduledAt.toISOString(), delayMs: delay },
    ip: input.ip,
    ua: input.ua,
  });
}

export async function publishNow(input: { postId: string; tenantId: string; actorId: string; ip?: string; ua?: string }): Promise<void> {
  const post = await Post.findOne({ _id: input.postId, tenantId: input.tenantId });
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found.');
  if (post.status === 'pending_approval') {
    throw new HttpError(409, 'NEEDS_APPROVAL', 'Post requires approval before publishing.');
  }
  await queue.add('publish', { postId: String(post._id), tenantId: String(post.tenantId) }, { jobId: `post:${post._id}` });
  post.status = 'publishing';
  await post.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.post_publish_requested',
    entity: 'Post',
    entityId: post._id,
    ip: input.ip,
    ua: input.ua,
  });
}

/**
 * Best-time-to-post recommendation stub. Real implementation aggregates per-tenant
 * historical engagement and returns top-N windows per platform. Phase 2.5.
 */
export function recommendBestTimes(platform: 'facebook' | 'instagram' | 'tiktok'): string[] {
  const defaults: Record<typeof platform, string[]> = {
    facebook: ['Wed 09:00', 'Thu 13:00', 'Sun 19:00'],
    instagram: ['Mon 11:00', 'Wed 15:00', 'Fri 19:00'],
    tiktok: ['Tue 06:00', 'Thu 19:00', 'Sat 22:00'],
  };
  return defaults[platform];
}
