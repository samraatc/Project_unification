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
 * Meta Graph API — Facebook Pages.
 *
 * Phase 2.1 ships the OAuth contract end-to-end; the HTTP exchanges to Graph
 * API are stubbed when `META_APP_ID` / `META_APP_SECRET` are absent so the
 * connect flow round-trips in dev. Phase 2.5 wires the real fetch.
 */

function appSecret(): string {
  return process.env.META_APP_SECRET ?? 'dev-meta-app-secret';
}

function appId(): string | undefined {
  return process.env.META_APP_ID;
}

const GRAPH_VERSION = 'v19.0';

export const facebookProvider: SocialProvider = {
  platform: 'facebook',
  formatConstraints: {
    // Facebook page post caption is effectively unlimited but we cap at 5k to keep
    // the API surface predictable.
    captionMax: 5000,
    hashtagMax: 30,
    mediaMax: 10,
    mediaMimeAccepted: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
    aspectRatios: ['1:1', '4:5', '16:9', '9:16'],
  },

  buildAuthorizationUrl(p: OAuthInitParams): string {
    const clientId = appId();
    if (!clientId) throw new Error('META_APP_ID is not configured.');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: p.redirectUri,
      state: p.state,
      response_type: 'code',
      scope: [
        'pages_show_list',
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_messaging',
        'public_profile',
      ].join(','),
      code_challenge: p.pkceChallenge,
      code_challenge_method: 'S256',
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  },

  async exchangeCode(p: OAuthExchangeParams): Promise<OAuthTokens> {
    if (!appId()) {
      logger.warn('META_APP_ID missing — returning dev stub OAuthTokens for facebook.');
      return {
        accessToken: 'dev-fb-token',
        externalAccountId: 'dev-fb-page-1',
        name: 'Dev Facebook Page',
        handle: 'devpage',
        pageId: 'dev-fb-page-1',
        scopes: ['pages_manage_posts'],
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      };
    }
    // TODO(phase-2.5): real fetch to /oauth/access_token + /me/accounts.
    logger.debug({ code: p.code.slice(0, 6) }, 'facebook OAuth exchange — real call wires in 2.5');
    return {
      accessToken: 'stub-fb-token',
      externalAccountId: 'stub-fb-page-1',
      name: 'Stub Facebook Page',
      pageId: 'stub-fb-page-1',
      scopes: ['pages_manage_posts'],
    };
  },

  async publish(args: {
    accessToken: string;
    externalAccountId: string;
    payload: PublishPayload;
  }): Promise<PublishResult> {
    // TODO(phase-2.5): POST /{page-id}/feed or /photos with `access_token`.
    logger.info(
      { platform: 'facebook', accountId: args.externalAccountId, mediaCount: args.payload.mediaUrls.length },
      'facebook publish — stubbed',
    );
    return {
      externalPostId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      publishedAt: new Date(),
    };
  },

  async getAccountMetrics(_args): Promise<MetricsSnapshot> {
    return {
      followers: 1234,
      reach: 5670,
      impressions: 9876,
      engagement: 432,
      clicks: 87,
      pulledAt: new Date(),
    };
  },

  verifyWebhookSignature({ rawBody, headers }): boolean {
    // Meta signs webhooks with `X-Hub-Signature-256: sha256=<hmac>` over the raw body.
    const sigHeader = headers['x-hub-signature-256'];
    if (!sigHeader || Array.isArray(sigHeader)) return false;
    const [scheme, presented] = sigHeader.split('=');
    if (scheme !== 'sha256' || !presented) return false;
    const expected = createHmac('sha256', appSecret()).update(rawBody).digest('hex');
    if (expected.length !== presented.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(presented, 'hex'));
    } catch {
      return false;
    }
  },
};
