import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';

import { loadEnv } from '../config/env.js';

const env = loadEnv();

/**
 * Envelope encryption helper.
 *
 * Spec: per-tenant data key encrypts field values; the data key itself is wrapped
 * by a customer master key (KMS). Phase 1.3 ships a software fallback that derives
 * a 256-bit key from `JWT_PRIVATE_KEY` (any persistent process secret) so the
 * encrypted-at-rest path is exercised in dev. Phase 1.5 replaces it with AWS KMS.
 */

const ALG = 'aes-256-gcm';

function masterKey(): Buffer {
  const salt = 'unified-platform-dev-salt';
  const material = env.JWT_PRIVATE_KEY ?? 'dev-only-master';
  return scryptSync(material, salt, 32);
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // `v1:` + base64(iv) + ':' + base64(ct) + ':' + base64(tag)
  return `v1:${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`;
}

export function decryptField(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Invalid cipher payload');
  const iv = Buffer.from(parts[1]!, 'base64');
  const ct = Buffer.from(parts[2]!, 'base64');
  const tag = Buffer.from(parts[3]!, 'base64');
  const decipher = createDecipheriv(ALG, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
