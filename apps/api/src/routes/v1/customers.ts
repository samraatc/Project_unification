import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  addCustomerNote,
  addTag,
  getCustomerProfile,
  listCustomers,
  removeTag,
} from '../../services/crm/crm.service.js';

export const customersRouter: Router = Router();

const ListQuery = z.object({
  q: z.string().max(200).optional(),
  segment: z.string().max(80).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

customersRouter.get(
  '/',
  requireAuth,
  requirePermission('users.read'),
  validate(ListQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof ListQuery>;
      const result = await listCustomers({
        tenantId: req.user!.tenantId,
        q: q.q,
        segment: q.segment,
        cursor: q.cursor,
        limit: q.limit,
      });
      res.json({ data: result.data, meta: { nextCursor: result.nextCursor } });
    } catch (err) {
      next(err);
    }
  },
);

customersRouter.get(
  '/:userId',
  requireAuth,
  requirePermission('users.read'),
  async (req, res, next) => {
    try {
      const profile = await getCustomerProfile(req.user!.tenantId, req.params.userId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },
);

const TagBody = z.object({ tag: z.string().min(1).max(40) });

customersRouter.post(
  '/:userId/tags',
  requireAuth,
  requirePermission('users.update'),
  validate(TagBody),
  async (req, res, next) => {
    try {
      await addTag({
        tenantId: req.user!.tenantId,
        userId: req.params.userId,
        tag: req.body.tag,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json({ status: 'added' });
    } catch (err) {
      next(err);
    }
  },
);

customersRouter.delete(
  '/:userId/tags/:tag',
  requireAuth,
  requirePermission('users.update'),
  async (req, res, next) => {
    try {
      await removeTag({
        tenantId: req.user!.tenantId,
        userId: req.params.userId,
        tag: req.params.tag,
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

const NoteBody = z.object({ subject: z.string().max(200).optional(), body: z.string().min(1).max(4000) });

customersRouter.post(
  '/:userId/notes',
  requireAuth,
  requirePermission('users.update'),
  validate(NoteBody),
  async (req, res, next) => {
    try {
      const note = await addCustomerNote({
        tenantId: req.user!.tenantId,
        userId: req.params.userId,
        actorId: req.user!.sub,
        body: req.body.body,
        subject: req.body.subject,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(note);
    } catch (err) {
      next(err);
    }
  },
);
