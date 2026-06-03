import { Role, UserRole } from '../db/models/index.js';
import { redis } from '../infra/redis.js';
import { logger } from '../config/logger.js';

/**
 * RBAC permission expansion + Redis cache.
 *
 * Security-Requirements §3: the user's permission set is the union of all role
 * permissions, cached in Redis with a 5-minute TTL, invalidated on role-assignment
 * change. `super_admin` carries the `'*'` wildcard which short-circuits checks.
 */

const CACHE_TTL_SECONDS = 5 * 60;
const cacheKey = (userId: string): string => `rbac:perms:${userId}`;

export interface ResolvedPermissions {
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export async function resolvePermissions(userId: string): Promise<ResolvedPermissions> {
  const cached = await redis.get(cacheKey(userId));
  if (cached) {
    try {
      return JSON.parse(cached) as ResolvedPermissions;
    } catch {
      // fall through to recompute
    }
  }

  const assignments = await UserRole.find({ userId }).select('roleId').lean();
  const roleIds = assignments.map((a) => a.roleId);
  if (roleIds.length === 0) {
    const empty: ResolvedPermissions = { roles: [], permissions: [], isSuperAdmin: false };
    await redis.set(cacheKey(userId), JSON.stringify(empty), 'EX', CACHE_TTL_SECONDS);
    return empty;
  }

  const roles = await Role.find({ _id: { $in: roleIds } }).select('code permissions').lean();
  const codes = roles.map((r) => r.code);
  const permSet = new Set<string>();
  let isSuperAdmin = false;

  for (const r of roles) {
    for (const p of r.permissions ?? []) {
      if (p === '*') isSuperAdmin = true;
      else permSet.add(p);
    }
    if (r.code === 'super_admin') isSuperAdmin = true;
  }

  const result: ResolvedPermissions = {
    roles: codes,
    permissions: [...permSet].sort(),
    isSuperAdmin,
  };
  await redis.set(cacheKey(userId), JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  return result;
}

export async function invalidatePermissionsCache(userId: string): Promise<void> {
  try {
    await redis.del(cacheKey(userId));
  } catch (err) {
    logger.warn({ err, userId }, 'failed to invalidate rbac cache');
  }
}

export function hasPermission(resolved: ResolvedPermissions, permission: string): boolean {
  if (resolved.isSuperAdmin) return true;
  return resolved.permissions.includes(permission);
}
