import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../../../config/logger.js';
import type {
  MetricsSnapshot,
  OAuthExchangeParams,
  OAuthInitParams,
  OAuthTokens,
  PublishPayload,
  PublishResult,
  SocialProvider,
} from './types.js';

/**
 * TikTok Marketing API.
 *
 * Phase 2.1 stubs the HTTP exchanges. Phase 2.5 wires the real auth + content
 * publishing endpoints once the developer-account creds land in Vault.
 */
function clientKey(): string | undefined {
  return process.env.TIKTOK_CLIENT_KEY;
}

function clientSecret(): string {
  return process.env.TIKTOK_CLIENT_SECRET ?? 'dev-tiktok-secret';
}

export const tiktokProvider: SocialProvider = {
  platform: 'tiktok',
  formatConstraints: {
    // TikTok caption hard limit is 2200; effective limit is lower because hashtags
    // and mentions eat into it. We cap conservatively.
    captionMax: 2200,
    hashtagMax: 100,
    mediaMax: 1, // single video per post
    mediaMimeAccepted: ['video/mp4', 'video/quicktime'],
    aspectRatios: ['9:16'],
  },

  buildAuthorizationUrl(p: OAuthInitParams): string {
    const key = clientKey();
    if (!key) throw new Error('TIKTOK_CLIENT_KEY is not configured.');
    const params = new URLSearchParams({
      client_key: key,
      response_type: 'code',
      scope: 'user.info.basic,video.publish,video.list,comment.list',
      redirect_uri: p.redirectUri,
      state: p.state,
      code_challenge: p.pkceChallenge,
      code_challenge_method: 'S256',
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  },

  async exchangeCode(p: OAuthExchangeParams): Promise<OAuthTokens> {
    if (!clientKey()) {
      logger.warn('TIKTOK_CLIENT_KEY missing — returning dev stub OAuthTokens.');
      return {
        accessToken: 'dev-tt-token',
        refreshToken: 'dev-tt-refresh',
        externalAccountId: 'dev-tt-user-1',
        name: 'Dev TikTok',
        handle: '@devtt',
        scopes: ['video.publish'],
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      };
    }
    // TODO(phase-2.5): POST https://open.tiktokapis.com/v2/oauth/token/.
    logger.debug({ code: p.code.slice(0, 6) }, 'tiktok OAuth exchange — real call wires in 2.5');
    return {
      accessToken: 'stub-tt-token',
      externalAccountId: 'stub-tt-user-1',
      scopes: ['video.publish'],
    };
  },

  async publish(args: {
    accessToken: string;
    externalAccountId: string;
    payload: PublishPayload;
  }): Promise<PublishResult> {
    if (args.payload.mediaUrls.length !== 1) {
      throw new Error('TikTok requires exactly one video media url.');
    }
    logger.info(
      { platform: 'tiktok', accountId: args.externalAccountId },
      'tiktok publish — stubbed',
    );
    return {
      externalPostId: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      publishedAt: new Date(),
    };
  },

  async getAccountMetrics(_args): Promise<MetricsSnapshot> {
    return {
      followers: 21500,
      reach: 76000,
      impressions: 134000,
      engagement: 9800,
      pulledAt: new Date(),
    };
  },

  verifyWebhookSignature({ rawBody, headers }): boolean {
    // TikTok webhooks sign with X-Webhook-Signature: t=<unix>,s=<hmac>.
    const sig = headers['x-webhook-signature'];
    if (!sig || Array.isArray(sig)) return false;
    const parts = Object.fromEntries(sig.split(',').map((kv) => kv.split('=') as [string, string]));
    const t = parts.t;
    const s = parts.s;
    if (!t || !s) return false;
    const expected = createHmac('sha256', clientSecret()).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
    if (expected.length !== s.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(s, 'hex'));
    } catch {
      return false;
    }
  },
};
