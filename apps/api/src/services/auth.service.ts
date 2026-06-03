import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import { User, type UserDoc } from '../db/models/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { audit } from './audit.service.js';
import { issueOtp } from './otp.service.js';
import { sendEmail, sendSms } from './notification.service.js';

const BCRYPT_COST = 12;
/** Minimal in-process breached-password screen; replaced by HIBP / Bloom filter in Phase 1.5. */
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '123456789',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  'iloveyou',
  '111111',
  'changeme',
]);

const DEFAULT_TENANT_ID = new Types.ObjectId('000000000000000000000001');

function screenPassword(password: string): void {
  if (password.length < 12) {
    throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be at least 12 characters.');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw new HttpError(400, 'BREACHED_PASSWORD', 'This password appears in breach databases.');
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  acceptedTermsAt: string;
  ip?: string;
  ua?: string;
}

export interface RegisterResult {
  userId: string;
  verifyChannel: 'email' | 'sms';
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  screenPassword(input.password);

  const existing = await User.findOne({ email: input.email }).select('_id status');
  if (existing) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const user = await User.create({
    tenantId: DEFAULT_TENANT_ID,
    email: input.email,
    phone: input.phone,
    passwordHash,
    status: 'pending',
    profile: { firstName: input.firstName, lastName: input.lastName },
    preferences: {
      notifications: { email: true, sms: true, push: true },
      locale: 'en',
      currency: 'USD',
      marketingOptIn: false,
    },
  });

  const { code, expiresAt } = await issueOtp({
    purpose: 'email_verify',
    channel: 'email',
    identifier: input.email,
    userId: user._id,
    ip: input.ip,
    ua: input.ua,
  });

  await sendEmail({
    to: input.email,
    subject: 'Verify your email — Unified Platform',
    template: 'email_verify',
    data: { code, expiresAt, firstName: input.firstName },
  });

  await audit({
    tenantId: DEFAULT_TENANT_ID,
    actorId: user._id,
    action: 'user.register',
    entity: 'User',
    entityId: user._id,
    afterJson: { email: '[REDACTED]', status: user.status },
    ip: input.ip,
    ua: input.ua,
  });

  return { userId: String(user._id), verifyChannel: 'email' };
}

export interface VerifyEmailInput {
  userId: string;
  ip?: string;
  ua?: string;
}

export async function activateUserAfterEmailVerify(input: VerifyEmailInput): Promise<UserDoc> {
  const user = await User.findById(input.userId);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  if (user.status === 'active') return user;

  user.status = 'active';
  user.emailVerifiedAt = new Date();
  await user.save();

  await audit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'user.email_verified',
    entity: 'User',
    entityId: user._id,
    ip: input.ip,
    ua: input.ua,
  });
  return user;
}

export async function requestPhoneOtp(phone: string, userId?: string, ip?: string, ua?: string): Promise<void> {
  const { code } = await issueOtp({
    purpose: 'phone_verify',
    channel: 'sms',
    identifier: phone,
    userId,
    ip,
    ua,
  });
  await sendSms({ to: phone, template: 'phone_verify', data: { code } });
}

export { DEFAULT_TENANT_ID };
