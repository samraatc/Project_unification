import { createHash, randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';

import { Otp } from '../db/models/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { redis } from '../infra/redis.js';

/**
 * OTP issuance + verification.
 *
 * Spec: 6-digit, 10-minute TTL, single-use, rate-limited 1/min and 5/hour per
 * identifier (PRD/FR-001, Security-Requirements §6). Codes are stored bcrypt-hashed;
 * cleartext is returned once for the dispatcher and never persisted.
 */
export type OtpPurpose = 'email_verify' | 'phone_verify' | 'password_reset' | 'login_step_up';
export type OtpChannel = 'email' | 'sms';

export interface IssueOtpInput {
  purpose: OtpPurpose;
  channel: OtpChannel;
  identifier: string;
  userId?: string | Types.ObjectId;
  ip?: string;
  ua?: string;
}

const OTP_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  // 6-digit cryptographically random; pad to preserve leading zeros.
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

async function checkRateLimit(purpose: OtpPurpose, identifier: string): Promise<void> {
  const minuteKey = `otp:rl:m:${purpose}:${identifier}`;
  const hourKey = `otp:rl:h:${purpose}:${identifier}`;

  const [minuteCount, hourCount] = await Promise.all([
    redis.incr(minuteKey),
    redis.incr(hourKey),
  ]);
  if (minuteCount === 1) await redis.expire(minuteKey, 60);
  if (hourCount === 1) await redis.expire(hourKey, 3600);

  if (minuteCount > 1) {
    throw new HttpError(429, 'OTP_RATE_LIMITED', 'Wait at least 60 seconds before requesting another code.');
  }
  if (hourCount > 5) {
    throw new HttpError(429, 'OTP_RATE_LIMITED', 'Too many OTP requests in the last hour.');
  }
}

export async function issueOtp(input: IssueOtpInput): Promise<{ code: string; expiresAt: Date }> {
  await checkRateLimit(input.purpose, input.identifier);
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  await Otp.create({
    purpose: input.purpose,
    channel: input.channel,
    identifier: input.identifier,
    userId: input.userId,
    codeHash,
    expiresAt,
    ip: input.ip,
    ua: input.ua,
  });
  return { code, expiresAt };
}

export interface VerifyOtpInput {
  purpose: OtpPurpose;
  identifier: string;
  code: string;
}

export async function verifyOtp(input: VerifyOtpInput): Promise<{ otpId: string; userId?: string }> {
  const otp = await Otp.findOne({
    purpose: input.purpose,
    identifier: input.identifier,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otp) {
    throw new HttpError(400, 'OTP_INVALID', 'OTP not found or expired.');
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many attempts. Request a new code.');
  }

  const ok = await bcrypt.compare(input.code, otp.codeHash);
  if (!ok) {
    otp.attempts += 1;
    await otp.save();
    throw new HttpError(400, 'OTP_INVALID', 'Invalid code.');
  }

  otp.consumedAt = new Date();
  await otp.save();
  return { otpId: String(otp._id), userId: otp.userId ? String(otp.userId) : undefined };
}

/** Hash used by password-reset tokens that get embedded in URLs (longer than OTP). */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
