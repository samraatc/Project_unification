import { Router } from 'express';
import { z } from 'zod';

import { Email, Phone } from '@unified/shared-types';

import { Role, User, UserRole } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/audit.service.js';
import { invalidatePermissionsCache } from '../../services/rbac.service.js';

export const usersRouter: Router = Router();

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'pending', 'suspended', 'deleted']).optional(),
});

usersRouter.get(
  '/',
  requireAuth,
  requirePermission('users.read'),
  validate(ListQuery, 'query'),
  async (req, res, next) => {
    try {
      const { cursor, limit, status } = req.query as unknown as z.infer<typeof ListQuery>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
      const filter: any = { tenantId: req.user!.tenantId };
      if (status) filter.status = status;
      if (cursor) filter._id = { $lt: cursor };
      const docs = await User.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .select('email phone status profile lastLoginAt createdAt')
        .lean();
      const hasMore = docs.length > limit;
      const items = hasMore ? docs.slice(0, limit) : docs;
      res.json({
        data: items.map((u) => ({
          id: String(u._id),
          email: u.email,
          phone: u.phone,
          status: u.status,
          firstName: u.profile?.firstName,
          lastName: u.profile?.lastName,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
        })),
        meta: { nextCursor: hasMore ? String(items[items.length - 1]?._id) : null },
      });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.get(
  '/:id',
  requireAuth,
  requirePermission('users.read'),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id)
        .select('-passwordHash -twoFA.secretCipher -twoFA.backupCodesHash -oauth.accessTokenCipher -oauth.refreshTokenCipher')
        .lean();
      if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
      const assignments = await UserRole.find({ userId: user._id }).populate('roleId', 'code name').lean();
      res.json({
        id: String(user._id),
        email: user.email,
        phone: user.phone,
        status: user.status,
        profile: user.profile,
        addresses: user.addresses,
        roles: assignments.map((a) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- populated ref
          code: (a.roleId as any)?.code,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: (a.roleId as any)?.name,
        })),
        createdAt: user.createdAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

const InviteUser = z.object({
  email: Email.optional(),
  phone: Phone.optional(),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  roleIds: z.array(z.string()).default([]),
}).refine((v) => v.email || v.phone, { message: 'email or phone required' });

usersRouter.post(
  '/',
  requireAuth,
  requirePermission('users.create'),
  validate(InviteUser),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof InviteUser>;
      const user = await User.create({
        tenantId: req.user!.tenantId,
        email: body.email?.toLowerCase(),
        phone: body.phone,
        status: 'pending',
        profile: { firstName: body.firstName, lastName: body.lastName },
      });
      for (const roleId of body.roleIds) {
        // eslint-disable-next-line no-await-in-loop
        await UserRole.create({
          tenantId: req.user!.tenantId,
          userId: user._id,
          roleId,
          assignedBy: req.user!.sub,
        });
      }
      await invalidatePermissionsCache(String(user._id));
      await audit({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        action: 'user.invited',
        entity: 'User',
        entityId: user._id,
        afterJson: { email: body.email, roleIds: body.roleIds },
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json({ id: String(user._id), status: user.status });
    } catch (err) {
      next(err);
    }
  },
);

const PatchUser = z.object({
  status: z.enum(['active', 'pending', 'suspended']).optional(),
  profile: z
    .object({
      firstName: z.string().max(80).optional(),
      lastName: z.string().max(80).optional(),
    })
    .optional(),
}).strict();

usersRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('users.update'),
  validate(PatchUser),
  async (req, res, next) => {
    try {
      const before = await User.findById(req.params.id).lean();
      if (!before) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
      const after = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
      await audit({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        action: 'user.updated',
        entity: 'User',
        entityId: req.params.id,
        beforeJson: { status: before.status, profile: before.profile },
        afterJson: { status: after?.status, profile: after?.profile },
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json({ id: String(after?._id), status: after?.status });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('users.delete'),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
      // Soft delete + PII anonymisation (Security-Requirements §11).
      user.status = 'deleted';
      user.deletedAt = new Date();
      user.email = undefined as unknown as string;
      user.phone = undefined as unknown as string;
      if (user.profile) {
        user.profile.firstName = 'Anonymised';
        user.profile.lastName = '';
        user.profile.avatarUrl = undefined as unknown as string;
        user.profile.dob = undefined as unknown as Date;
      }
      user.addresses = [];
      await user.save();
      await invalidatePermissionsCache(req.params.id);
      await audit({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        action: 'user.deleted',
        entity: 'User',
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

const AssignRoles = z.object({ roleIds: z.array(z.string()).min(0) });

usersRouter.post(
  '/:id/roles',
  requireAuth,
  requirePermission('roles.assign'),
  validate(AssignRoles),
  async (req, res, next) => {
    try {
      const userId = req.params.id;
      const { roleIds } = req.body as z.infer<typeof AssignRoles>;
      // Replace the assignment set. Block reassigning a super_admin role unless the
      // caller is itself super_admin (PRD §2: only Super Admin can manage Super Admins).
      const superAdminRole = await Role.findOne({ tenantId: req.user!.tenantId, code: 'super_admin' }).select('_id');
      const wantsSuperAdmin = superAdminRole && roleIds.includes(String(superAdminRole._id));
      if (wantsSuperAdmin && !req.user!.roles.includes('super_admin')) {
        throw new HttpError(403, 'FORBIDDEN', 'Only Super Admin can assign Super Admin.');
      }
      await UserRole.deleteMany({ tenantId: req.user!.tenantId, userId });
      for (const roleId of roleIds) {
        // eslint-disable-next-line no-await-in-loop
        await UserRole.create({
          tenantId: req.user!.tenantId,
          userId,
          roleId,
          assignedBy: req.user!.sub,
        });
      }
      await invalidatePermissionsCache(userId);
      await audit({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        action: 'user.roles_assigned',
        entity: 'User',
        entityId: userId,
        afterJson: { roleIds },
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json({ id: userId, roleIds });
    } catch (err) {
      next(err);
    }
  },
);
