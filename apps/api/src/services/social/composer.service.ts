import { Types } from 'mongoose';

import { Post, SocialAccount, type PostDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { providerFor, type Platform } from './providers/index.js';

/**
 * Unified composer service.
 *
 * One composer payload + array of targets → one Post document. Each target may
 * override caption/hashtags/media to satisfy per-platform constraints; the
 * `validateOverrides` helper runs the format check before persistence so the
 * worker never sees an invalid payload at publish time.
 */

export interface ComposerTargetInput {
  socialAccountId: string;
  overrides?: {
    caption?: string;
    hashtags?: string[];
    mediaKeys?: string[];
    firstComment?: string;
  };
}

export interface CreatePostInput {
  tenantId: string;
  actorId: string;
  content: string;
  mediaKeys: string[];
  targets: ComposerTargetInput[];
  scheduledAt?: Date;
  requiresApproval: boolean;
  ip?: string;
  ua?: string;
}

export async function createPost(input: CreatePostInput): Promise<PostDoc> {
  if (input.targets.length === 0) {
    throw new HttpError(400, 'NO_TARGETS', 'Provide at least one social account target.');
  }
  const accountIds = input.targets.map((t) => t.socialAccountId);
  const accounts = await SocialAccount.find({
    _id: { $in: accountIds },
    tenantId: input.tenantId,
    status: 'connected',
  })
    .select('_id platform externalAccountId')
    .lean();
  if (accounts.length !== input.targets.length) {
    throw new HttpError(400, 'INVALID_TARGETS', 'One or more targets are not connected accounts.');
  }

  const targets = input.targets.map((t) => {
    const account = accounts.find((a) => String(a._id) === t.socialAccountId)!;
    const platform = account.platform as Platform;
    const caption = t.overrides?.caption ?? input.content;
    const hashtags = t.overrides?.hashtags ?? extractHashtags(input.content);
    const mediaKeys = t.overrides?.mediaKeys ?? input.mediaKeys;
    validatePayload(platform, { caption, hashtags, mediaKeys });
    return {
      socialAccountId: new Types.ObjectId(t.socialAccountId),
      platform,
      overrides: { caption, hashtags, mediaKeys, firstComment: t.overrides?.firstComment },
      status: 'pending' as const,
    };
  });

  const status = input.requiresApproval
    ? 'pending_approval'
    : input.scheduledAt
      ? 'scheduled'
      : 'draft';

  const post = await Post.create({
    tenantId: input.tenantId,
    content: input.content,
    mediaKeys: input.mediaKeys,
    targets,
    scheduledAt: input.scheduledAt,
    status,
    createdBy: input.actorId,
    approvalRequestedAt: input.requiresApproval ? new Date() : undefined,
  });

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.post_created',
    entity: 'Post',
    entityId: post._id,
    afterJson: { status, targetCount: targets.length, scheduledAt: input.scheduledAt },
    ip: input.ip,
    ua: input.ua,
  });
  return post;
}

function extractHashtags(content: string): string[] {
  const matches = content.match(/#[A-Za-z0-9_]+/g) ?? [];
  return [...new Set(matches.map((h) => h.toLowerCase()))];
}

export function validatePayload(
  platform: Platform,
  payload: { caption: string; hashtags: string[]; mediaKeys: string[] },
): void {
  const constraints = providerFor(platform).formatConstraints;
  if (payload.caption.length > constraints.captionMax) {
    throw new HttpError(
      400,
      'CAPTION_TOO_LONG',
      `Caption exceeds ${constraints.captionMax} characters for ${platform}.`,
    );
  }
  if (payload.hashtags.length > constraints.hashtagMax) {
    throw new HttpError(
      400,
      'TOO_MANY_HASHTAGS',
      `${platform} accepts at most ${constraints.hashtagMax} hashtags.`,
    );
  }
  if (payload.mediaKeys.length > constraints.mediaMax) {
    throw new HttpError(
      400,
      'TOO_MUCH_MEDIA',
      `${platform} accepts at most ${constraints.mediaMax} media items per post.`,
    );
  }
  if (platform === 'tiktok' && payload.mediaKeys.length !== 1) {
    throw new HttpError(400, 'TIKTOK_REQUIRES_VIDEO', 'TikTok posts require exactly one video.');
  }
}

export interface ApprovalInput {
  postId: string;
  tenantId: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function approvePost(input: ApprovalInput): Promise<PostDoc> {
  const post = await Post.findOne({ _id: input.postId, tenantId: input.tenantId });
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found.');
  if (post.status !== 'pending_approval') {
    throw new HttpError(409, 'NOT_PENDING', 'Post is not pending approval.');
  }
  post.approvedBy = new Types.ObjectId(input.actorId) as unknown as PostDoc['approvedBy'];
  post.approvedAt = new Date();
  post.status = post.scheduledAt ? 'scheduled' : 'draft';
  await post.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.post_approved',
    entity: 'Post',
    entityId: post._id,
    ip: input.ip,
    ua: input.ua,
  });
  return post;
}

export async function rejectPost(input: ApprovalInput & { reason: string }): Promise<PostDoc> {
  const post = await Post.findOne({ _id: input.postId, tenantId: input.tenantId });
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found.');
  post.status = 'draft';
  post.rejectedReason = input.reason;
  await post.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.post_rejected',
    entity: 'Post',
    entityId: post._id,
    afterJson: { reason: input.reason },
    ip: input.ip,
    ua: input.ua,
  });
  return post;
}
