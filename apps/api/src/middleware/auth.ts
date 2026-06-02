import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { loadEnv } from '../config/env.js';
import { HttpError } from './errorHandler.js';

/**
 * JWT verification middleware. Phase 0 skeleton — full RS256 key rotation
 * and refresh-token family revocation arrive in Phase 1 (FR-001).
 */
export interface AuthenticatedUser {
  sub: string;
  roles: string[];
  tenantId?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new HttpError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
  }
  const token = header.slice('Bearer '.length).trim();
  const env = loadEnv();
  const key = env.JWT_PUBLIC_KEY ?? 'dev-only-insecure-key';
  try {
    const decoded = jwt.verify(token, key) as jwt.JwtPayload;
    req.user = {
      sub: String(decoded.sub ?? ''),
      roles: Array.isArray(decoded.roles) ? (decoded.roles as string[]) : [],
      tenantId: decoded.tenantId as string | undefined,
    };
    next();
  } catch {
    next(new HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired token'));
  }
}

/**
 * Deny-by-default permission guard. The full permission set + tenant entitlement
 * checks land in Phase 1 (FR-002). This is the API the rest of the codebase imports.
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Auth required'));
    // Skeleton: any role passes; replace in Phase 1 with the cached role→permission expansion.
    const ok = req.user.roles.length > 0 || permission === '*';
    if (!ok) return next(new HttpError(403, 'FORBIDDEN', `Missing permission: ${permission}`));
    next();
  };
}

/**
 * Premium entitlement guard. Stub for Phase 6 (FR-016). Resolves the tenant's
 * active subscription and feature gate. Phase 0 returns 402 when called.
 */
export function requireEntitlement(featureCode: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next(
      new HttpError(
        402,
        'PAYMENT_REQUIRED',
        `Feature '${featureCode}' requires an active subscription`,
      ),
    );
  };
}
