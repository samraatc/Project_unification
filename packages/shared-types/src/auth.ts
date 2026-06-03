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

export const RegisterRequest = z
  .object({
    email: Email,
    password: Password,
    phone: Phone.optional(),
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    acceptedTermsAt: z.string().datetime(),
  })
  .strict();
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const VerifyEmailRequest = z
  .object({
    userId: z.string().min(1),
    code: OtpCode,
  })
  .strict();
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequest>;

export const RequestPhoneOtpRequest = z
  .object({
    phone: Phone,
  })
  .strict();
export type RequestPhoneOtpRequest = z.infer<typeof RequestPhoneOtpRequest>;

export const VerifyPhoneRequest = z
  .object({
    phone: Phone,
    code: OtpCode,
  })
  .strict();
export type VerifyPhoneRequest = z.infer<typeof VerifyPhoneRequest>;

export const LoginRequest = z
  .object({
    identifier: z.union([Email, Phone]),
    password: Password,
    totp: OtpCode.optional(),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequest>;

export const PasswordForgotRequest = z
  .object({
    identifier: z.union([Email, Phone]),
  })
  .strict();
export type PasswordForgotRequest = z.infer<typeof PasswordForgotRequest>;

export const PasswordResetRequest = z
  .object({
    token: z.string().min(32).max(256),
    newPassword: Password,
  })
  .strict();
export type PasswordResetRequest = z.infer<typeof PasswordResetRequest>;

export const PasswordChangeRequest = z
  .object({
    currentPassword: Password,
    newPassword: Password,
  })
  .strict();
export type PasswordChangeRequest = z.infer<typeof PasswordChangeRequest>;

export const TotpSetupResponse = z.object({
  otpauthUrl: z.string().url(),
  backupCodes: z.array(z.string()).length(10),
});
export type TotpSetupResponse = z.infer<typeof TotpSetupResponse>;

export const TotpVerifyRequest = z
  .object({
    code: OtpCode,
  })
  .strict();
export type TotpVerifyRequest = z.infer<typeof TotpVerifyRequest>;

export const TokenPair = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPair>;

export const JwtClaims = z.object({
  sub: z.string(),
  tenantId: z.string(),
  roles: z.array(BuiltInRole.or(z.string())),
  perms: z.array(z.string()).optional(),
  amr: z.array(z.enum(['pwd', 'otp', 'oauth', 'totp'])).optional(),
  iat: z.number(),
  exp: z.number(),
});
export type JwtClaims = z.infer<typeof JwtClaims>;
