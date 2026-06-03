import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';

import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * JWT issuance + verification.
 *
 * Spec: RS256, 15-minute access, 7-day refresh, signing key rotated every 90 days
 * (Security-Requirements §2). For dev, if no `JWT_PRIVATE_KEY` is provided we
 * generate an in-process keypair so the service boots; the public JWK set served
 * from `/.well-known/jwks.json` (lands in Phase 1.4) reads the same key.
 */

const env = loadEnv();

interface KeyPair {
  privateKey: Secret;
  publicKey: Secret;
  kid: string;
}

function loadOrGenerate(): KeyPair {
  if (env.JWT_PRIVATE_KEY && env.JWT_PUBLIC_KEY) {
    return {
      privateKey: env.JWT_PRIVATE_KEY,
      publicKey: env.JWT_PUBLIC_KEY,
      kid: 'env',
    };
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production.');
  }
  logger.warn('No JWT keys in env — generating an ephemeral keypair (dev only).');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    kid: 'dev-ephemeral',
  };
}

const keys = loadOrGenerate();

function parseDurationSeconds(spec: string): number {
  const match = /^(\d+)([smhd])$/.exec(spec);
  if (!match) throw new Error(`Invalid duration: ${spec}`);
  const n = Number(match[1]);
  const unit = match[2];
  return unit === 's' ? n : unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
}

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  roles: string[];
  perms: string[];
  amr: ('pwd' | 'otp' | 'oauth' | 'totp')[];
}

export function signAccessToken(payload: AccessTokenPayload): { token: string; expiresIn: number } {
  const expiresIn = parseDurationSeconds(env.JWT_ACCESS_TTL);
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn,
    keyid: keys.kid,
    issuer: 'unified-platform',
    audience: 'unified-clients',
  };
  const token = jwt.sign(payload, keys.privateKey, options);
  return { token, expiresIn };
}

export function verifyAccessToken(token: string): AccessTokenPayload & jwt.JwtPayload {
  return jwt.verify(token, keys.publicKey, {
    algorithms: ['RS256'],
    issuer: 'unified-platform',
    audience: 'unified-clients',
  }) as AccessTokenPayload & jwt.JwtPayload;
}

/** Public key in PEM — feeds the JWKS endpoint in Phase 1.4. */
export function getPublicKeyPem(): string {
  return typeof keys.publicKey === 'string'
    ? keys.publicKey
    : (createPublicKey(keys.publicKey as Buffer).export({ type: 'spki', format: 'pem' }) as string);
}

export function getPrivateKeyPem(): string {
  return typeof keys.privateKey === 'string'
    ? keys.privateKey
    : (createPrivateKey(keys.privateKey as Buffer).export({ type: 'pkcs8', format: 'pem' }) as string);
}

export function getActiveKid(): string {
  return keys.kid;
}
