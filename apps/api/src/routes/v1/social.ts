import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';

import { Post, SocialAccount } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  completeConnect,
  disconnectAccount,
  initiateConnect,
} from '../../services/social/connect.service.js';
import {
  approvePost,
  createPost,
  rejectPost,
} from '../../services/social/composer.service.js';
import {
  publishNow,
  recommendBestTimes,
  schedulePost,
} from '../../services/social/scheduler.service.js';
import {
  assignMessage,
  ingestMessage,
  replyToMessage,
} from '../../services/social/inbox.service.js';
import {
  confirmUpload,
  presignUpload,
  searchMedia,
} from '../../services/social/mediaLibrary.service.js';
import {
  operationsSummary,
  summaryByPlatform,
} from '../../services/social/analytics.service.js';
import { PLATFORMS, providerFor } from '../../services/social/providers/index.js';
import { InboxMessage } from '../../db/models/inboxMessage.model.js';

export const socialRouter: Router = Router();

const PlatformParam = z.object({ platform: z.enum(['facebook', 'instagram', 'tiktok']) });

/* -------------------------------------------------------------------------- */
/* Accounts                                                                   */
/* -------------------------------------------------------------------------- */

socialRouter.get(
  '/accounts',
  requireAuth,
  requirePermission('social.read'),
  async (req, res, next) => {
    try {
      const accounts = await SocialAccount.find({ tenantId: req.user!.tenantId })
        .select('platform externalAccountId name handle avatarUrl status connectedAt')
        .sort({ platform: 1, name: 1 })
        .lean();
      res.json({ data: accounts });
    } catch (err) {
      next(err);
    }
  },
);

socialRouter.post(
  '/accounts/:platform/connect',
  requireAuth,
  requirePermission('social.connect'),
  async (req, res, next) => {
    try {
      const { platform } = PlatformParam.parse(req.params);
      const result = await initiateConnect({
        platform,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

socialRouter.get(
  '/accounts/:platform/callback',
  async (req, res, next) => {
    try {
      const { platform } = PlatformParam.parse(req.params);
      const result = await completeConnect({
        platform,
        code: String(req.query.code ?? ''),
        state: String(req.query.state ?? ''),
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      const adminBase = process.env.ADMIN_BASE_URL ?? 'http://localhost:3001';
      res.redirect(`${adminBase}/social/accounts?connected=${result.accountId}`);
    } catch (err) {
      next(err);
    }
  },
);

socialRouter.delete(
  '/accounts/:id',
  requireAuth,
  requirePermission('social.connect'),
  async (req, res, next) => {
    try {
      await disconnectAccount({
        accountId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

socialRouter.get(
  '/accounts/format-constraints',
  requireAuth,
  requirePermission('social.read'),
  (_req, res) => {
    res.json({
      data: PLATFORMS.map((p) => ({ platform: p, ...providerFor(p).formatConstraints })),
    });
  },
);

/* -------------------------------------------------------------------------- */
/* Posts (composer + scheduler + approvals)                                   */
/* -------------------------------------------------------------------------- */

const CreatePostBody = z
  .object({
    content: z.string().min(1).max(5000),
    mediaKeys: z.array(z.string()).max(20).default([]),
    targets: z
      .array(
        z.object({
          socialAccountId: z.string().min(1),
          overrides: z
            .object({
              caption: z.string().max(5000).optional(),
              hashtags: z.array(z.string()).max(100).optional(),
              mediaKeys: z.array(z.string()).max(20).optional(),
              firstComment: z.string().max(2000).optional(),
            })
            .optional(),
        }),
      )
      .min(1),
    scheduledAt: z.string().datetime().optional(),
    requiresApproval: z.boolean().default(false),
  })
  .strict();

socialRouter.post(
  '/posts',
  requireAuth,
  requirePermission('social.draft'),
  validate(CreatePostBody),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof CreatePostBody>;
      const post = await createPost({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        content: body.content,
        mediaKeys: body.mediaKeys,
        targets: body.targets,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        requiresApproval: body.requiresApproval,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(post);
    } catch (err) {
      next(err);
    }
  },
);

const ListPostsQuery = z.object({
  status: z
    .enum(['draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed'])
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

socialRouter.get(
  '/posts',
  requireAuth,
  requirePermission('social.read'),
  validate(ListPostsQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof ListPostsQuery>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
      const filter: any = { tenantId: req.user!.tenantId };
      if (q.status) filter.status = q.status;
      if (q.cursor) filter._id = { $lt: q.cursor };
      const docs = await Post.find(filter).sort({ _id: -1 }).limit(q.limit + 1).lean();
      const hasMore = docs.length > q.limit;
      const items = hasMore ? docs.slice(0, q.limit) : docs;
      res.json({
        data: items,
        meta: { nextCursor: hasMore ? String(items[items.length - 1]?._id) : null },
      });
    } catch (err) {
      next(err);
    }
  },
);

const ScheduleBody = z.object({ scheduledAt: z.string().datetime() });

socialRouter.post(
  '/posts/:id/schedule',
  requireAuth,
  requirePermission('social.schedule'),
  validate(ScheduleBody),
  async (req, res, next) => {
    try {
      await schedulePost({
        postId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        scheduledAt: new Date(req.body.scheduledAt),
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json({ status: 'scheduled' });
    } catch (err) {
      next(err);
    }
  },
);

socialRouter.post(
  '/posts/:id/publish',
  requireAuth,
  requirePermission('social.publish'),
  async (req, res, next) => {
    try {
      await publishNow({
        postId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json({ status: 'publishing' });
    } catch (err) {
      next(err);
    }
  },
);

socialRouter.post(
  '/posts/:id/approve',
  requireAuth,
  requirePermission('social.publish'),
  async (req, res, next) => {
    try {
      const post = await approvePost({
        postId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(post);
    } catch (err) {
      next(err);
    }
  },
);

const RejectBody = z.object({ reason: z.string().min(1).max(1000) });

socialRouter.post(
  '/posts/:id/reject',
  requireAuth,
  requirePermission('social.publish'),
  validate(RejectBody),
  async (req, res, next) => {
    try {
      const post = await rejectPost({
        postId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        reason: req.body.reason,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(post);
    } catch (err) {
      next(err);
    }
  },
);

socialRouter.get(
  '/best-times',
  requireAuth,
  requirePermission('social.read'),
  (req, res) => {
    const platform = z.enum(['facebook', 'instagram', 'tiktok']).parse(req.query.platform);
    res.json({ platform, recommendations: recommendBestTimes(platform) });
  },
);

/* -------------------------------------------------------------------------- */
/* Inbox                                                                      */
/* -------------------------------------------------------------------------- */

const ListInboxQuery = z.object({
  status: z.enum(['new', 'open', 'responded', 'closed']).optional(),
  platform: z.enum(['facebook', 'instagram', 'tiktok']).optional(),
  assignedTo: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

socialRouter.get(
  '/inbox',
  requireAuth,
  requirePermission('inbox.read'),
  validate(ListInboxQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof ListInboxQuery>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
      const filter: any = { tenantId: req.user!.tenantId, direction: 'inbound' };
      if (q.status) filter.status = q.status;
      if (q.platform) filter.platform = q.platform;
      if (q.assignedTo) filter.assignedTo = q.assignedTo;
      if (q.cursor) filter._id = { $lt: q.cursor };
      const docs = await InboxMessage.find(filter).sort({ _id: -1 }).limit(q.limit + 1).lean();
      const hasMore = docs.length > q.limit;
      const items = hasMore ? docs.slice(0, q.limit) : docs;
      res.json({
        data: items,
        meta: { nextCursor: hasMore ? String(items[items.length - 1]?._id) : null },
      });
    } catch (err) {
      next(err);
    }
  },
);

const AssignBody = z.object({ assigneeId: z.string().min(1) });

socialRouter.post(
  '/inbox/:id/assign',
  requireAuth,
  requirePermission('inbox.assign'),
  validate(AssignBody),
  async (req, res, next) => {
    try {
      const msg = await assignMessage({
        messageId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        assigneeId: req.body.assigneeId,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(msg);
    } catch (err) {
      next(err);
    }
  },
);

const ReplyBody = z.object({ body: z.string().min(1).max(5000) });

socialRouter.post(
  '/inbox/:id/reply',
  requireAuth,
  requirePermission('inbox.reply'),
  validate(ReplyBody),
  async (req, res, next) => {
    try {
      const reply = await replyToMessage({
        messageId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        body: req.body.body,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(reply);
    } catch (err) {
      next(err);
    }
  },
);

// Test-only endpoint to seed the inbox in dev. Phase 2.4 webhook does this for real.
socialRouter.post(
  '/inbox/_test/ingest',
  requireAuth,
  requirePermission('inbox.read'),
  async (req, res, next) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new HttpError(404, 'NOT_FOUND', 'Endpoint disabled in production.');
      }
      const body = z
        .object({
          platform: z.enum(['facebook', 'instagram', 'tiktok']),
          externalAccountId: z.string(),
          externalMessageId: z.string().default(() => `dev-${Date.now()}`),
          body: z.string().min(1),
          authorHandle: z.string().optional(),
          kind: z.enum(['comment', 'dm', 'mention']).default('comment'),
        })
        .parse(req.body);
      const doc = await ingestMessage({
        tenantId: req.user!.tenantId,
        ...body,
      });
      res.status(doc ? 201 : 200).json(doc ?? { status: 'duplicate' });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Media library                                                              */
/* -------------------------------------------------------------------------- */

const PresignBody = z.object({
  filename: z.string().min(1).max(200),
  mime: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

socialRouter.post(
  '/media/presign',
  requireAuth,
  requirePermission('social.draft'),
  validate(PresignBody),
  async (req, res, next) => {
    try {
      const result = await presignUpload({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ...req.body,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

const ConfirmBody = z.object({
  key: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  altText: z.string().max(500).optional(),
});

socialRouter.post(
  '/media/confirm',
  requireAuth,
  requirePermission('social.draft'),
  validate(ConfirmBody),
  async (req, res, next) => {
    try {
      const asset = await confirmUpload({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...req.body,
      });
      res.status(201).json(asset);
    } catch (err) {
      next(err);
    }
  },
);

const SearchMediaQuery = z.object({
  q: z.string().max(200).optional(),
  tags: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((t) => t.trim()).filter(Boolean) : undefined)),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

socialRouter.get(
  '/media',
  requireAuth,
  requirePermission('social.read'),
  validate(SearchMediaQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof SearchMediaQuery>;
      const result = await searchMedia({
        tenantId: req.user!.tenantId,
        query: q.q,
        tags: q.tags,
        cursor: q.cursor,
        limit: q.limit,
      });
      res.json({ data: result.data, meta: { nextCursor: result.nextCursor } });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

const AnalyticsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

socialRouter.get(
  '/analytics',
  requireAuth,
  requirePermission('social.analytics'),
  validate(AnalyticsQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof AnalyticsQuery>;
      const from = q.from ? new Date(q.from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const to = q.to ? new Date(q.to) : new Date();
      const [perPlatform, ops] = await Promise.all([
        summaryByPlatform(req.user!.tenantId),
        operationsSummary(req.user!.tenantId, { from, to }),
      ]);
      res.json({
        range: { from: from.toISOString(), to: to.toISOString() },
        platforms: perPlatform,
        operations: ops,
      });
    } catch (err) {
      next(err);
    }
  },
);

void Types; // import retained for tsc cycle hint
