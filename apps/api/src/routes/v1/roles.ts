import { Router } from 'express';
import { z } from 'zod';

import { Permission, Role, UserRole } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/audit.service.js';
import { invalidatePermissionsCache } from '../../services/rbac.service.js';

export const rolesRouter: Router = Router();
export const permissionsRouter: Router = Router();

permissionsRouter.get(
  '/',
  requireAuth,
  requirePermission('roles.read'),
  async (_req, res, next) => {
    try {
      const items = await Permission.find().sort({ domain: 1, code: 1 }).lean();
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  },
);

rolesRouter.get(
  '/',
  requireAuth,
  requirePermission('roles.read'),
  async (req, res, next) => {
    try {
      const items = await Role.find({ tenantId: req.user!.tenantId }).sort({ isSystem: -1, code: 1 }).lean();
      res.json({ data: items });
    } catch (err) {
      next(err);
    }
  },
);

const CreateRole = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, 'lowercase + underscore only'),
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  permissions: z.array(z.string()).default([]),
});

rolesRouter.post(
  '/',
  requireAuth,
  requirePermission('roles.create'),
  validate(CreateRole),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof CreateRole>;
      if (body.permissions.includes('*') && !req.user!.roles.includes('super_admin')) {
        throw new HttpError(403, 'FORBIDDEN', 'Only Super Admin can grant wildcard permissions.');
      }
      const role = await Role.create({
        tenantId: req.user!.tenantId,
        ...body,
        isSystem: false,
        createdBy: req.user!.sub,
      });
      await audit({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        action: 'role.created',
        entity: 'Role',
        entityId: role._id,
        afterJson: body,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  },
);

const UpdateRole = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(400).optional(),
  permissions: z.array(z.string()).optional(),
}).strict();

rolesRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('roles.update'),
  validate(UpdateRole),
  async (req, res, next) => {
    try {
      const before = await Role.findById(req.params.id).lean();
      if (!before) throw new HttpError(404, 'ROLE_NOT_FOUND', 'Role not found.');
      if (before.isSystem && (req.body as z.infer<typeof UpdateRole>).permissions) {
        throw new HttpError(409, 'SYSTEM_ROLE_LOCKED', 'System role permissions cannot be edited.');
      }
      const after = await Role.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
      // Invalidate every user who has this role.
      const assignments = await UserRole.find({ roleId: req.params.id }).select('userId').lean();
      await Promise.all(assignments.map((a) => invalidatePermissionsCache(String(a.userId))));
      await audit({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        action: 'role.updated',
        entity: 'Role',
        entityId: req.params.id,
        beforeJson: before,
        afterJson: after,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(after);
    } catch (err) {
      next(err);
    }
  },
);

rolesRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('roles.delete'),
  async (req, res, next) => {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) throw new HttpError(404, 'ROLE_NOT_FOUND', 'Role not found.');
      if (role.isSystem) throw new HttpError(409, 'SYSTEM_ROLE_LOCKED', 'System role cannot be deleted.');
      const inUse = await UserRole.countDocuments({ roleId: role._id });
      if (inUse > 0) throw new HttpError(409, 'ROLE_IN_USE', `Role assigned to ${inUse} user(s).`);
      await role.deleteOne();
      await audit({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        action: 'role.deleted',
        entity: 'Role',
        entityId: req.params.id,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
