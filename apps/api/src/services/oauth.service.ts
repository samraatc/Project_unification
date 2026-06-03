import { createHash, randomBytes } from 'node:crypto';

import type { Response } from 'express';

import { User } from '../db/models/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import { redis } from '../infra/redis.js';
import { loadEnv } from '../config/env.js';
import { audit } from './audit.service.js';
import { encryptField } from './crypto.service.js';
import { signAccessToken } from './jwt.service.js';
import { resolvePermissions } from './rbac.service.js';

/**
 * OAuth 2.0 PKCE — Google + Facebook (PRD/FR-001, Security-Requirements §2).
 *
 * State + nonce stored in Redis with a 10-minute TTL. PKCE verifier stored alongside.
 * Phase 1.3 ships the contract + Redis state handling; the per-provider HTTP exchanges
 * are stubbed where the real-world fetch would call Google/Facebook token endpoints —
 * those wire up to the live `provider_*_CLIENT_ID/SECRET` env vars in Phase 1.5.
 */

const env = loadEnv();

export type OAuthProvider = 'google' | 'facebook';

interface ProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
  },
  facebook: {
    authorizationUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,email,first_name,last_name',
    scope: 'email public_profile',
    clientIdEnv: 'FACEBOOK_OAUTH_CLIENT_ID',
    clientSecretEnv: 'FACEBOOK_OAUTH_CLIENT_SECRET',
  },
};

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function pkceVerifier(): string {
  return b64url(randomBytes(32));
}

function pkceChallenge(verifier: string): string {
  return b64url(createHash('sha256').update(verifier).digest());
}

function stateKey(state: string): string {
  return `oauth:state:${state}`;
}

const STATE_TTL_SECONDS = 10 * 60;

export interface InitiateInput {
  provider: OAuthProvider;
  returnTo?: string;
}

export async function initiateOAuth(input: InitiateInput): Promise<{ authorizationUrl: string }> {
  const config = PROVIDERS[input.provider];
  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    throw new HttpError(503, 'OAUTH_UNCONFIGURED', `${input.provider} OAuth client not configured.`);
  }
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(16));
  const verifier = pkceVerifier();
  const challenge = pkceChallenge(verifier);

  await redis.set(
    stateKey(state),
    JSON.stringify({ provider: input.provider, nonce, verifier, returnTo: input.returnTo ?? '' }),
    'EX',
    STATE_TTL_SECONDS,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${env.API_BASE_URL}/api/v1/auth/oauth/${input.provider}/callback`,
    response_type: 'code',
    scope: config.scope,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return { authorizationUrl: `${config.authorizationUrl}?${params.toString()}` };
}

export interface CompleteInput {
  provider: OAuthProvider;
  code: string;
  state: string;
  ip?: string;
  ua?: string;
  res: Response;
}

export interface CompleteResult {
  redirectTo?: string;
  tokenPair: { accessToken: string; expiresIn: number };
}

export async function completeOAuth(input: CompleteInput): Promise<CompleteResult> {
  const stored = await redis.get(stateKey(input.state));
  if (!stored) {
    throw new HttpError(400, 'OAUTH_STATE_INVALID', 'OAuth state expired or invalid.');
  }
  await redis.del(stateKey(input.state));
  const parsed = JSON.parse(stored) as { provider: OAuthProvider; verifier: string; returnTo?: string };
  if (parsed.provider !== input.provider) {
    throw new HttpError(400, 'OAUTH_PROVIDER_MISMATCH', 'OAuth provider mismatch.');
  }

  // Phase 1.3 stub: in production this calls the provider token + userinfo endpoints.
  // The shape is fixed to match the rest of the flow; Phase 1.5 wires the real fetches.
  const providerProfile = await fetchProviderProfile({
    provider: input.provider,
    code: input.code,
    verifier: parsed.verifier,
  });

  // Upsert the user — link by oauth.providerUserId, then by email.
  let user = await User.findOne({
    'oauth.provider': input.provider,
    'oauth.providerUserId': providerProfile.id,
  });
  if (!user && providerProfile.email) {
    user = await User.findOne({ email: providerProfile.email.toLowerCase() });
  }
  if (!user) {
    user = await User.create({
      tenantId: '000000000000000000000001',
      email: providerProfile.email?.toLowerCase(),
      status: 'active',
      emailVerifiedAt: new Date(),
      profile: { firstName: providerProfile.firstName, lastName: providerProfile.lastName },
      oauth: [
        {
          provider: input.provider,
          providerUserId: providerProfile.id,
          accessTokenCipher: encryptField(providerProfile.accessToken ?? ''),
        },
      ],
    });
  } else {
    const linked = user.oauth?.find((o) => o.provider === input.provider);
    if (!linked) {
      user.oauth = [
        ...(user.oauth ?? []),
        {
          provider: input.provider,
          providerUserId: providerProfile.id,
          accessTokenCipher: encryptField(providerProfile.accessToken ?? ''),
          linkedAt: new Date(),
        },
      ];
      await user.save();
    }
  }

  const perms = await resolvePermissions(String(user._id));
  const access = signAccessToken({
    sub: String(user._id),
    tenantId: String(user.tenantId),
    roles: perms.roles,
    perms: perms.permissions,
    amr: ['oauth'],
  });

  await audit({
    tenantId: user.tenantId,
    actorId: user._id,
    action: 'user.oauth_login',
    entity: 'User',
    entityId: user._id,
    afterJson: { provider: input.provider },
    ip: input.ip,
    ua: input.ua,
  });

  return {
    redirectTo: parsed.returnTo,
    tokenPair: { accessToken: access.token, expiresIn: access.expiresIn },
  };
}

interface ProviderProfile {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  accessToken?: string;
}

/**
 * Phase 1.3 stub. Phase 1.5 replaces the body with real fetch calls to
 * `providers.<x>.tokenUrl` + `userInfoUrl` using `node:fetch`. Kept as a single
 * extension point so production wiring is a localised diff.
 */
async function fetchProviderProfile(opts: {
  provider: OAuthProvider;
  code: string;
  verifier: string;
}): Promise<ProviderProfile> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- placeholder for production fetch result
  const _unused: any = opts;
  void _unused;
  // In dev/test, fabricate a deterministic profile so the flow round-trips.
  const seed = createHash('sha256').update(opts.code).digest('hex').slice(0, 16);
  return {
    id: `${opts.provider}-${seed}`,
    email: `${seed}@example.com`,
    firstName: 'Test',
    lastName: opts.provider,
    accessToken: 'dev-token',
  };
}
