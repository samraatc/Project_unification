import { createHmac, randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { User } from '../db/models/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { audit } from './audit.service.js';
import { decryptField, encryptField } from './crypto.service.js';

/**
 * RFC 6238 TOTP — 30-second step, 6 digits, SHA-1 HMAC. Required for Super Admin
 * and Admin (Security-Requirements §2); offered to all users.
 *
 * Backup codes: 10 single-use, bcrypt-hashed at rest.
 */

const STEP_SECONDS = 30;
const WINDOW = 1; // tolerate ±1 step for clock drift

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = str.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  let bits = '';
  for (const ch of clean) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error('Invalid base32 character');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  }
  const rem = bits.length % 5;
  if (rem !== 0) {
    out += alphabet[parseInt(bits.slice(-rem).padEnd(5, '0'), 2)];
  }
  return out;
}

function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function totpAt(secret: string, step: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const bin =
    ((h[offset]! & 0x7f) << 24) |
    ((h[offset + 1]! & 0xff) << 16) |
    ((h[offset + 2]! & 0xff) << 8) |
    (h[offset + 3]! & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}

function verifyTotpCode(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let i = -WINDOW; i <= WINDOW; i++) {
    if (totpAt(secret, now + i) === code) return true;
  }
  return false;
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    // 10 chars, alphanumeric, easy to type.
    codes.push(randomBytes(6).toString('base64url').slice(0, 10).toLowerCase());
  }
  return codes;
}

/* -------------------------------------------------------------------------- */

export interface EnrollInput {
  userId: string;
  ip?: string;
  ua?: string;
}

export interface EnrollResult {
  otpauthUrl: string;
  backupCodes: string[];
}

export async function enrollTotp(input: EnrollInput): Promise<EnrollResult> {
  const user = await User.findById(input.userId).select('email tenantId twoFA');
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  if (user.twoFA?.enabled) {
    throw new HttpError(409, 'TOTP_ALREADY_ENABLED', 'TOTP is already enabled.');
  }

  const secret = generateSecret();
  const backupCodes = generateBackupCodes();
  const backupCodesHash = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  user.twoFA = {
    enabled: false,
    secretCipher: encryptField(secret),
    backupCodesHash,
    enrolledAt: undefined as unknown as Date,
  };
  await user.save();

  const label = encodeURIComponent(user.email ?? `user:${input.userId}`);
  const issuer = encodeURIComponent('Unified Platform');
  const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  return { otpauthUrl, backupCodes };
}

export async function verifyTotpEnrolment(input: { userId: string; code: string; ip?: string; ua?: string }): Promise<void> {
  const user = await User.findById(input.userId).select('+twoFA.secretCipher twoFA tenantId');
  if (!user?.twoFA?.secretCipher) {
    throw new HttpError(400, 'TOTP_NOT_ENROLLED', 'Run /2fa/setup first.');
  }
  const secret = decryptField(user.twoFA.secretCipher);
  if (!verifyTotpCode(secret, input.code)) {
    throw new HttpError(400, 'TOTP_INVALID', 'Invalid TOTP code.');
  }
  user.twoFA.enabled = true;
  user.twoFA.enrolledAt = new Date();
  await user.save();
  await audit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'user.totp_enabled',
    entity: 'User',
    entityId: user._id,
    ip: input.ip,
    ua: input.ua,
  });
}

export async function verifyTotpForLogin(userId: string, code: string): Promise<boolean> {
  const user = await User.findById(userId).select('+twoFA.secretCipher +twoFA.backupCodesHash twoFA');
  if (!user?.twoFA?.enabled || !user.twoFA.secretCipher) return false;
  const secret = decryptField(user.twoFA.secretCipher);
  if (verifyTotpCode(secret, code)) return true;
  // Try backup codes.
  const codes = user.twoFA.backupCodesHash ?? [];
  for (let i = 0; i < codes.length; i++) {
    const hash = codes[i]!;
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(code, hash)) {
      codes.splice(i, 1);
      user.twoFA.backupCodesHash = codes;
      await user.save();
      return true;
    }
  }
  return false;
}

export async function disableTotp(input: { userId: string; code: string; ip?: string; ua?: string }): Promise<void> {
  const ok = await verifyTotpForLogin(input.userId, input.code);
  if (!ok) throw new HttpError(401, 'TOTP_INVALID', 'Invalid TOTP code.');
  const user = await User.findById(input.userId).select('twoFA tenantId');
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  user.twoFA = {
    enabled: false,
    secretCipher: undefined as unknown as string,
    backupCodesHash: [],
    enrolledAt: undefined as unknown as Date,
  };
  await user.save();
  await audit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'user.totp_disabled',
    entity: 'User',
    entityId: user._id,
    ip: input.ip,
    ua: input.ua,
  });
}
