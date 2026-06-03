import { createHash, randomBytes } from 'node:crypto';

import { SocialAccount } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { redis } from '../../infra/redis.js';
import { loadEnv } from '../../config/env.js';
import { audit } from '../audit.service.js';
import { encryptField } from '../crypto.service.js';
import { providerFor, type Platform } from './providers/index.js';

/**
 * Social-account connect/disconnect orchestration.
 *
 * The OAuth flow mirrors `oauth.service.ts` but is namespaced per tenant: the
 * `state` payload remembers which tenant + user kicked off the connect so the
 * callback can attribute the account correctly.
 */

const env = loadEnv();
const STATE_TTL_SECONDS = 10 * 60;
const stateKey = (state: string): string => `social:oauth:state:${state}`;

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function pkceChallenge(verifier: string): string {
  return b64url(createHash('sha256').update(verifier).digest());
}

function redirectUriFor(platform: Platform): string {
  return `${env.API_BASE_URL}/api/v1/social/accounts/${platform}/callback`;
}

export interface InitiateConnectInput {
  platform: Platform;
  tenantId: string;
  actorId: string;
}

export async function initiateConnect(input: InitiateConnectInput): Promise<{ authorizationUrl: string }> {
  const provider = providerFor(input.platform);
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));

  await redis.set(
    stateKey(state),
    JSON.stringify({
      platform: input.platform,
      verifier,
      tenantId: input.tenantId,
      actorId: input.actorId,
    }),
    'EX',
    STATE_TTL_SECONDS,
  );

  const url = provider.buildAuthorizationUrl({
    state,
    pkceChallenge: pkceChallenge(verifier),
    redirectUri: redirectUriFor(input.platform),
  });
  return { authorizationUrl: url };
}

export interface CompleteConnectInput {
  platform: Platform;
  code: string;
  state: string;
  ip?: string;
  ua?: string;
}

export async function completeConnect(input: CompleteConnectInput): Promise<{ accountId: string; redirectTo?: string }> {
  const raw = await redis.get(stateKey(input.state));
  if (!raw) throw new HttpError(400, 'OAUTH_STATE_INVALID', 'OAuth state expired or invalid.');
  await redis.del(stateKey(input.state));
  const parsed = JSON.parse(raw) as { platform: Platform; verifier: string; tenantId: string; actorId: string };
  if (parsed.platform !== input.platform) {
    throw new HttpError(400, 'OAUTH_PROVIDER_MISMATCH', 'Provider mismatch.');
  }

  const provider = providerFor(input.platform);
  const tokens = await provider.exchangeCode({
    code: input.code,
    pkceVerifier: parsed.verifier,
    redirectUri: redirectUriFor(input.platform),
  });

  const updated = await SocialAccount.findOneAndUpdate(
    {
      tenantId: parsed.tenantId,
      platform: input.platform,
      externalAccountId: tokens.externalAccountId,
    },
    {
      $set: {
        tenantId: parsed.tenantId,
        platform: input.platform,
        externalAccountId: tokens.externalAccountId,
        name: tokens.name,
        handle: tokens.handle,
        avatarUrl: tokens.avatarUrl,
        pageId: tokens.pageId,
        oauth: {
          accessTokenCipher: encryptField(tokens.accessToken),
          refreshTokenCipher: tokens.refreshToken ? encryptField(tokens.refreshToken) : undefined,
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
        },
        status: 'connected',
        connectedBy: parsed.actorId,
        connectedAt: new Date(),
        lastError: undefined,
      },
    },
    { upsert: true, new: true },
  );

  await audit({
    tenantId: parsed.tenantId,
    actorId: parsed.actorId,
    action: 'social.account_connected',
    entity: 'SocialAccount',
    entityId: updated._id,
    afterJson: { platform: input.platform, externalAccountId: tokens.externalAccountId },
    ip: input.ip,
    ua: input.ua,
  });
  return { accountId: String(updated._id) };
}

export interface DisconnectInput {
  accountId: string;
  tenantId: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function disconnectAccount(input: DisconnectInput): Promise<void> {
  const account = await SocialAccount.findOne({ _id: input.accountId, tenantId: input.tenantId });
  if (!account) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'Social account not found.');
  account.status = 'disconnected';
  account.disconnectedAt = new Date();
  account.oauth = {
    accessTokenCipher: undefined as unknown as string,
    refreshTokenCipher: undefined as unknown as string,
    expiresAt: undefined as unknown as Date,
    scopes: [],
  };
  await account.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.account_disconnected',
    entity: 'SocialAccount',
    entityId: account._id,
    ip: input.ip,
    ua: input.ua,
  });
}
