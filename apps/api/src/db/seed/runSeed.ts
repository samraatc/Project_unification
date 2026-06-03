import { Permission, Role } from '../models/index.js';
import { logger } from '../../config/logger.js';
import { PERMISSION_CATALOGUE } from './permissions.js';
import { ROLE_CATALOGUE } from './roles.js';

/**
 * Idempotent seed — safe to run on every boot. Upserts the permission catalogue
 * and the built-in roles. Tenant-scoped roles are upserted per tenant in the
 * tenant-provisioning flow (lands with tenant management in Phase 1.4).
 */
export async function seedIdentity(tenantId: string): Promise<void> {
  await Permission.bulkWrite(
    PERMISSION_CATALOGUE.map((p) => ({
      updateOne: {
        filter: { code: p.code },
        update: { $set: p },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  await Role.bulkWrite(
    ROLE_CATALOGUE.map((r) => ({
      updateOne: {
        filter: { tenantId, code: r.code },
        update: {
          $set: {
            tenantId,
            code: r.code,
            name: r.name,
            description: r.description,
            isSystem: true,
            permissions: r.permissions,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  logger.info(
    { permissions: PERMISSION_CATALOGUE.length, roles: ROLE_CATALOGUE.length, tenantId },
    'identity seed applied',
  );
}
