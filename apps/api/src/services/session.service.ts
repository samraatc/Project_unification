import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { Types } from 'mongoose';

import { RefreshToken, User } from '../db/models/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { audit } from './audit.service.js';
import { sendEmail } from './notification.service.js';
import { resolvePermissions } from './rbac.service.js';
import { signAccessToken } from './jwt.service.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

const env = loadEnv();

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const REFRESH_COOKIE_NAME = 'refresh_token';
const PASSWORD_RESET_TTL_MIN = 30;

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_THRESHOLD_SOFT = 5; // 1 minute cool-down
const LOCKOUT_THRESHOLD_HARD = 10; // 15 minute cool-down

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function newRefreshToken(): string {
  // 32-byte cryptographically random; URL-safe base64.
  return randomBytes(32).toString('base64url');
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'strict',
    domain: env.REFRESH_COOKIE_DOMAIN || undefined,
    path: '/api/v1/auth',
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'strict',
    domain: env.REFRESH_COOKIE_DOMAIN || undefined,
    path: '/api/v1/auth',
  });
}

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

export interface LoginInput {
  identifier: string;
  password: string;
  totp?: string;
  ip?: string;
  ua?: string;
  res: Response;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: { id: string; email?: string; phone?: string; firstName?: string; lastName?: string };
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const lookup = input.identifier.includes('@')
    ? { email: input.identifier.toLowerCase() }
    : { phone: input.identifier };

  const user = await User.findOne(lookup).select(
    '+passwordHash +failedLoginAttempts +lockedUntil +twoFA.enabled +twoFA.secretCipher',
  );
  if (!user || !user.passwordHash) {
    // Generic message — no user enumeration.
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  if (user.status === 'suspended' || user.status === 'deleted') {
    throw new HttpError(403, 'ACCOUNT_DISABLED', 'Account is not available.');
  }
  if (user.status === 'pending') {
    throw new HttpError(403, 'EMAIL_UNVERIFIED', 'Verify your email before signing in.');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, 'ACCOUNT_LOCKED', 'Account temporarily locked. Try again later.');
  }

  const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordOk) {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD_HARD) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_WINDOW_MS);
    } else if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD_SOFT) {
      user.lockedUntil = new Date(Date.now() + 60_000);
    }
    await user.save();
    await audit({
      tenantId: user.tenantId,
      actorId: user._id,
      action: 'user.login_failed',
      entity: 'User',
      entityId: user._id,
      ip: input.ip,
      ua: input.ua,
    });
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  }

  if (user.twoFA?.enabled) {
    if (!input.totp) {
      throw new HttpError(401, 'TOTP_REQUIRED', 'TOTP code required.');
    }
    const { verifyTotpForLogin } = await import('./totp.service.js');
    const ok = await verifyTotpForLogin(String(user._id), input.totp);
    if (!ok) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
    }
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined as unknown as Date;
  user.lastLoginAt = new Date();
  await user.save();

  const perms = await resolvePermissions(String(user._id));
  const access = signAccessToken({
    sub: String(user._id),
    tenantId: String(user.tenantId),
    roles: perms.roles,
    perms: perms.permissions,
    amr: user.twoFA?.enabled ? ['pwd', 'totp'] : ['pwd'],
  });

  // Issue refresh token + persist its hash.
  const refresh = newRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    family: randomBytes(16).toString('hex'),
    tokenHash: sha256(refresh),
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    ip: input.ip,
    ua: input.ua,
  });
  setRefreshCookie(input.res, refresh);

  await audit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'user.login',
    entity: 'User',
    entityId: user._id,
    ip: input.ip,
    ua: input.ua,
  });

  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    user: {
      id: String(user._id),
      email: user.email,
      phone: user.phone,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Refresh                                                                    */
/* -------------------------------------------------------------------------- */

export interface RefreshInput {
  cookieToken?: string;
  ip?: string;
  ua?: string;
  res: Response;
}

export async function refreshSession(input: RefreshInput): Promise<{ accessToken: string; expiresIn: number }> {
  if (!input.cookieToken) throw new HttpError(401, 'NO_REFRESH', 'Missing refresh token.');
  const presented = sha256(input.cookieToken);
  const record = await RefreshToken.findOne({ tokenHash: presented });
  if (!record) {
    // Token unknown OR already rotated — treat as theft, revoke any family we can find.
    throw new HttpError(401, 'REFRESH_INVALID', 'Refresh token invalid.');
  }
  if (record.revokedAt) {
    // Replay of a rotated token — revoke the whole family.
    await RefreshToken.updateMany(
      { family: record.family, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    logger.warn({ family: record.family }, 'refresh token replay detected — family revoked');
    throw new HttpError(401, 'REFRESH_REUSE_DETECTED', 'Session invalidated for security reasons.');
  }
  if (record.expiresAt < new Date()) {
    throw new HttpError(401, 'REFRESH_EXPIRED', 'Refresh token expired.');
  }

  // Rotate.
  record.revokedAt = new Date();
  record.rotatedAt = new Date();
  await record.save();

  const fresh = newRefreshToken();
  await RefreshToken.create({
    userId: record.userId,
    family: record.family,
    tokenHash: sha256(fresh),
    parentTokenHash: record.tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    ip: input.ip,
    ua: input.ua,
  });
  setRefreshCookie(input.res, fresh);

  const user = await User.findById(record.userId).select('tenantId');
  if (!user) throw new HttpError(401, 'REFRESH_INVALID', 'Refresh token invalid.');

  const perms = await resolvePermissions(String(user._id));
  const access = signAccessToken({
    sub: String(user._id),
    tenantId: String(user.tenantId),
    roles: perms.roles,
    perms: perms.permissions,
    amr: ['pwd'],
  });
  return { accessToken: access.token, expiresIn: access.expiresIn };
}

/* -------------------------------------------------------------------------- */
/* Logout                                                                     */
/* -------------------------------------------------------------------------- */

export interface LogoutInput {
  cookieToken?: string;
  userId: string;
  res: Response;
}

export async function logout(input: LogoutInput): Promise<void> {
  if (input.cookieToken) {
    const presented = sha256(input.cookieToken);
    const record = await RefreshToken.findOne({ tokenHash: presented });
    if (record) {
      await RefreshToken.updateMany(
        { family: record.family, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
      );
    }
  }
  clearRefreshCookie(input.res);
  await audit({
    tenantId: new Types.ObjectId('000000000000000000000001'),
    actorId: input.userId,
    action: 'user.logout',
    entity: 'User',
    entityId: input.userId,
  });
}

/* -------------------------------------------------------------------------- */
/* Password reset / change                                                    */
/* -------------------------------------------------------------------------- */

export interface ForgotInput {
  identifier: string;
  ip?: string;
  ua?: string;
}

export async function forgotPassword(input: ForgotInput): Promise<void> {
  const lookup = input.identifier.includes('@')
    ? { email: input.identifier.toLowerCase() }
    : { phone: input.identifier };
  const user = await User.findOne(lookup).select('_id email tenantId');
  if (!user) {
    // Don't reveal that the user doesn't exist.
    return;
  }
  const token = randomBytes(32).toString('base64url');
  const { issueOtp } = await import('./otp.service.js');
  // Store the hash inside an `otp` document as a reset token (PRD/FR-001 channel-agnostic reset).
  // The reset link uses the raw token; the stored hash is bcrypt for opaque tokens.
  await issueOtp({
    purpose: 'password_reset',
    channel: 'email',
    identifier: user.email ?? input.identifier,
    userId: user._id,
    ip: input.ip,
    ua: input.ua,
  }).catch(() => undefined);

  await sendEmail({
    to: user.email ?? input.identifier,
    subject: 'Reset your password — Unified Platform',
    template: 'password_reset',
    data: {
      // For dev visibility — the email worker will template a real link.
      resetUrl: `${env.STOREFRONT_BASE_URL}/reset-password?token=${token}`,
      expiresInMinutes: PASSWORD_RESET_TTL_MIN,
    },
  });
}

export interface ResetInput {
  token: string;
  newPassword: string;
  ip?: string;
  ua?: string;
}

export async function resetPassword(_input: ResetInput): Promise<void> {
  // Phase 1.2 stub — the real flow validates the opaque token from `forgotPassword`,
  // rehashes the password, revokes all refresh-token families for the user, and
  // writes an audit entry. Wire to the `otps` collection once the reset-token store lands.
  throw new HttpError(501, 'NOT_IMPLEMENTED', 'Password reset is being completed in Sprint 1.2.');
}

export interface ChangeInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ip?: string;
  ua?: string;
}

export async function changePassword(input: ChangeInput): Promise<void> {
  const user = await User.findById(input.userId).select('+passwordHash tenantId');
  if (!user || !user.passwordHash) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  user.passwordHash = await bcrypt.hash(input.newPassword, 12);
  await user.save();
  // Revoke all refresh tokens — force re-login everywhere.
  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
  await audit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'user.password_changed',
    entity: 'User',
    entityId: user._id,
    ip: input.ip,
    ua: input.ua,
  });
}
