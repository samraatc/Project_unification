import { z } from 'zod';

import { BuiltInRole } from './roles.js';

/** PRD §FR-001 — RFC 6238 TOTP, 6-digit OTPs, JWT 15m access / 7d refresh. */

export const Email = z.string().email().max(254);
export const Phone = z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Phone must be E.164 format');
export const Password = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const OtpCode = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');

export const SignupRequest = z
  .object({
    email: Email,
    password: Password,
    phone: Phone.optional(),
    acceptedTermsAt: z.string().datetime(),
  })
  .strict();
export type SignupRequest = z.infer<typeof SignupRequest>;

export const LoginRequest = z
  .object({
    email: Email,
    password: Password,
    totp: OtpCode.optional(),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequest>;

export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPair>;

export const JwtClaims = z.object({
  sub: z.string(),
  roles: z.array(BuiltInRole.or(z.string())),
  tenantId: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
});
export type JwtClaims = z.infer<typeof JwtClaims>;
