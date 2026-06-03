import { logger } from '../../../config/logger.js';
import { facebookProvider } from './facebook.js';
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
 * Instagram Business — runs through the same Meta Graph token as Facebook Pages
 * (the Instagram business account is attached to a Facebook Page). Webhook
 * signature uses the same Meta app secret, so we delegate to the Facebook provider.
 */
export const instagramProvider: SocialProvider = {
  platform: 'instagram',
  formatConstraints: {
    captionMax: 2200,
    hashtagMax: 30,
    mediaMax: 10, // carousel
    mediaMimeAccepted: ['image/jpeg', 'image/png', 'video/mp4'],
    aspectRatios: ['1:1', '4:5', '16:9'],
  },

  buildAuthorizationUrl(p: OAuthInitParams): string {
    // Instagram Business OAuth uses the same Facebook authorization URL with
    // additional `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments` scopes.
    const url = facebookProvider.buildAuthorizationUrl(p);
    return url.replace(
      'pages_show_list',
      [
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_comments',
        'pages_show_list',
      ].join(','),
    );
  },

  async exchangeCode(p: OAuthExchangeParams): Promise<OAuthTokens> {
    const tokens = await facebookProvider.exchangeCode(p);
    return {
      ...tokens,
      externalAccountId: `ig-${tokens.externalAccountId}`,
      name: `Instagram (${tokens.name ?? 'business'})`,
    };
  },

  async publish(args: {
    accessToken: string;
    externalAccountId: string;
    payload: PublishPayload;
  }): Promise<PublishResult> {
    logger.info(
      { platform: 'instagram', accountId: args.externalAccountId, mediaCount: args.payload.mediaUrls.length },
      'instagram publish — stubbed',
    );
    // TODO(phase-2.5): POST /{ig-user-id}/media (container) → /{ig-user-id}/media_publish.
    return {
      externalPostId: `ig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      publishedAt: new Date(),
    };
  },

  async getAccountMetrics(_args): Promise<MetricsSnapshot> {
    return {
      followers: 8123,
      reach: 15400,
      impressions: 27800,
      engagement: 1450,
      pulledAt: new Date(),
    };
  },

  verifyWebhookSignature: facebookProvider.verifyWebhookSignature,
};
