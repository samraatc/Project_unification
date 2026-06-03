import { Router } from 'express';
import { z } from 'zod';

import { User } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/audit.service.js';
import { resolvePermissions } from '../../services/rbac.service.js';

export const meRouter: Router = Router();

meRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.sub)
      .select('-passwordHash -twoFA.secretCipher -twoFA.backupCodesHash -oauth.accessTokenCipher -oauth.refreshTokenCipher')
      .lean();
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
    res.json({
      id: String(user._id),
      email: user.email,
      phone: user.phone,
      status: user.status,
      profile: user.profile,
      addresses: user.addresses,
      preferences: user.preferences,
      twoFAEnabled: user.twoFA?.enabled ?? false,
    });
  } catch (err) {
    next(err);
  }
});

const PatchMe = z
  .object({
    profile: z
      .object({
        firstName: z.string().max(80).optional(),
        lastName: z.string().max(80).optional(),
        avatarUrl: z.string().url().optional(),
        dob: z.string().datetime().optional(),
        gender: z.string().max(20).optional(),
      })
      .optional(),
    preferences: z
      .object({
        notifications: z
          .object({
            email: z.boolean().optional(),
            sms: z.boolean().optional(),
            push: z.boolean().optional(),
          })
          .optional(),
        locale: z.string().max(10).optional(),
        currency: z.string().length(3).optional(),
        marketingOptIn: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

meRouter.patch('/', requireAuth, validate(PatchMe), async (req, res, next) => {
  try {
    const updates: Record<string, unknown> = {};
    if (req.body.profile) {
      for (const [k, v] of Object.entries(req.body.profile)) {
        updates[`profile.${k}`] = v;
      }
    }
    if (req.body.preferences) {
      for (const [k, v] of Object.entries(req.body.preferences)) {
        updates[`preferences.${k}`] = v;
      }
    }
    const updated = await User.findByIdAndUpdate(req.user!.sub, { $set: updates }, { new: true })
      .select('-passwordHash')
      .lean();
    await audit({
      tenantId: req.user!.tenantId,
      actorId: req.user!.sub,
      action: 'user.self_updated',
      entity: 'User',
      entityId: req.user!.sub,
      afterJson: req.body,
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    res.json({ id: req.user!.sub, profile: updated?.profile, preferences: updated?.preferences });
  } catch (err) {
    next(err);
  }
});

meRouter.get('/permissions', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolvePermissions(req.user!.sub);
    res.json({
      userId: req.user!.sub,
      roles: resolved.roles,
      permissions: resolved.isSuperAdmin ? ['*'] : resolved.permissions,
      isSuperAdmin: resolved.isSuperAdmin,
      // Entitlements land with Phase 6 — return an empty list for now.
      entitlements: [] as string[],
    });
  } catch (err) {
    next(err);
  }
});
