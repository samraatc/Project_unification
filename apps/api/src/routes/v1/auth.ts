import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// Per-route limiter — Security-Requirements §6: 60/min/IP on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

import {
  LoginRequest,
  PasswordChangeRequest,
  PasswordForgotRequest,
  PasswordResetRequest,
  RegisterRequest,
  RequestPhoneOtpRequest,
  TotpVerifyRequest,
  VerifyEmailRequest,
  VerifyPhoneRequest,
} from '@unified/shared-types';

import { audit } from '../../services/audit.service.js';
import {
  activateUserAfterEmailVerify,
  register,
  requestPhoneOtp,
} from '../../services/auth.service.js';
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  refreshSession,
  resetPassword,
} from '../../services/session.service.js';
import {
  disableTotp,
  enrollTotp,
  verifyTotpEnrolment,
} from '../../services/totp.service.js';
import { verifyOtp } from '../../services/otp.service.js';
import {
  initiateOAuth,
  completeOAuth,
  OAuthProvider,
} from '../../services/oauth.service.js';

import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const authRouter: Router = Router();

authRouter.use(authLimiter);

/* -------------------------------------------------------------------------- */
/* Registration / OTP verify (Phase 1.1)                                      */
/* -------------------------------------------------------------------------- */

authRouter.post('/register', validate(RegisterRequest), async (req, res, next) => {
  try {
    const result = await register({
      ...req.body,
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify', validate(VerifyEmailRequest), async (req, res, next) => {
  try {
    const { userId, code } = req.body as { userId: string; code: string };
    // Look up the user first to recover the identifier the OTP was issued against.
    const { User } = await import('../../db/models/index.js');
    const candidate = await User.findById(userId).select('email');
    if (!candidate?.email) {
      throw new HttpError(400, 'OTP_INVALID', 'Verification code invalid or expired.');
    }
    await verifyOtp({ purpose: 'email_verify', identifier: candidate.email, code });
    const user = await activateUserAfterEmailVerify({ userId, ip: req.ip, ua: req.headers['user-agent'] });
    res.json({ id: String(user._id), status: user.status, emailVerifiedAt: user.emailVerifiedAt });
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/phone-otp/request',
  requireAuth,
  validate(RequestPhoneOtpRequest),
  async (req, res, next) => {
    try {
      await requestPhoneOtp(req.body.phone, req.user?.sub, req.ip, req.headers['user-agent']);
      res.status(202).json({ status: 'sent' });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/phone-otp/verify',
  requireAuth,
  validate(VerifyPhoneRequest),
  async (req, res, next) => {
    try {
      await verifyOtp({ purpose: 'phone_verify', identifier: req.body.phone, code: req.body.code });
      await audit({
        tenantId: req.user!.tenantId ?? '000000000000000000000001',
        actorId: req.user!.sub,
        action: 'user.phone_verified',
        entity: 'User',
        entityId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json({ status: 'verified' });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Login / logout / refresh (Phase 1.2)                                       */
/* -------------------------------------------------------------------------- */

authRouter.post('/login', validate(LoginRequest), async (req, res, next) => {
  try {
    const result = await login({
      identifier: req.body.identifier,
      password: req.body.password,
      totp: req.body.totp,
      ip: req.ip,
      ua: req.headers['user-agent'],
      res,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const result = await refreshSession({
      cookieToken: req.cookies?.refresh_token as string | undefined,
      ip: req.ip,
      ua: req.headers['user-agent'],
      res,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await logout({
      cookieToken: req.cookies?.refresh_token as string | undefined,
      userId: req.user!.sub,
      res,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------------- */
/* Password reset / change (Phase 1.2)                                        */
/* -------------------------------------------------------------------------- */

authRouter.post(
  '/password/forgot',
  validate(PasswordForgotRequest),
  async (req, res, next) => {
    try {
      await forgotPassword({ identifier: req.body.identifier, ip: req.ip, ua: req.headers['user-agent'] });
      // Always 202 to avoid user-enumeration (Security-Requirements §2).
      res.status(202).json({ status: 'queued' });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post('/password/reset', validate(PasswordResetRequest), async (req, res, next) => {
  try {
    await resetPassword({ token: req.body.token, newPassword: req.body.newPassword, ip: req.ip, ua: req.headers['user-agent'] });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/password/change',
  requireAuth,
  validate(PasswordChangeRequest),
  async (req, res, next) => {
    try {
      await changePassword({
        userId: req.user!.sub,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* 2FA TOTP (Phase 1.3)                                                       */
/* -------------------------------------------------------------------------- */

authRouter.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const result = await enrollTotp({ userId: req.user!.sub, ip: req.ip, ua: req.headers['user-agent'] });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/2fa/verify',
  requireAuth,
  validate(TotpVerifyRequest),
  async (req, res, next) => {
    try {
      await verifyTotpEnrolment({ userId: req.user!.sub, code: req.body.code, ip: req.ip, ua: req.headers['user-agent'] });
      res.json({ status: 'enabled' });
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/2fa/disable',
  requireAuth,
  validate(TotpVerifyRequest),
  async (req, res, next) => {
    try {
      await disableTotp({ userId: req.user!.sub, code: req.body.code, ip: req.ip, ua: req.headers['user-agent'] });
      res.json({ status: 'disabled' });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* OAuth — Google / Facebook PKCE (Phase 1.3)                                 */
/* -------------------------------------------------------------------------- */

const OAuthProviderParam = z.object({ provider: z.enum(['google', 'facebook']) });

authRouter.get('/oauth/:provider', async (req, res, next) => {
  try {
    const { provider } = OAuthProviderParam.parse(req.params);
    const result = await initiateOAuth({
      provider: provider as OAuthProvider,
      // Where to redirect the user after the callback. Storefront vs admin (D-0005).
      returnTo: typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined,
    });
    res.redirect(result.authorizationUrl);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/oauth/:provider/callback', async (req, res, next) => {
  try {
    const { provider } = OAuthProviderParam.parse(req.params);
    const result = await completeOAuth({
      provider: provider as OAuthProvider,
      code: String(req.query.code ?? ''),
      state: String(req.query.state ?? ''),
      ip: req.ip,
      ua: req.headers['user-agent'],
      res,
    });
    if (result.redirectTo) return res.redirect(result.redirectTo);
    res.json(result.tokenPair);
  } catch (err) {
    next(err);
  }
});
