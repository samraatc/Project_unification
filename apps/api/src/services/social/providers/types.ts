/**
 * SocialProvider — the contract every platform integration implements.
 *
 * One file per provider (`facebook.ts`, `instagram.ts`, `tiktok.ts`) so swapping
 * out for a mock in tests is a localised import. Architecture.md §3.
 */

export type Platform = 'facebook' | 'instagram' | 'tiktok';

export interface OAuthInitParams {
  state: string;
  pkceChallenge: string;
  redirectUri: string;
}

export interface OAuthExchangeParams {
  code: string;
  pkceVerifier: string;
  redirectUri: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  externalAccountId: string;
  name?: string;
  handle?: string;
  avatarUrl?: string;
  pageId?: string;
}

export interface PublishPayload {
  caption: string;
  hashtags: string[];
  mediaUrls: string[]; // CDN URLs of S3-hosted media
  firstComment?: string;
}

export interface PublishResult {
  externalPostId: string;
  publishedAt: Date;
}

export interface MetricsSnapshot {
  followers?: number;
  reach?: number;
  impressions?: number;
  engagement?: number;
  clicks?: number;
  pulledAt: Date;
}

export interface PostMetrics {
  externalPostId: string;
  impressions?: number;
  reach?: number;
  engagement?: number;
  clicks?: number;
}

export interface SocialProvider {
  platform: Platform;

  /**
   * Per-platform format constraints. Used by the composer to validate overrides
   * before they ever hit the publish worker.
   */
  formatConstraints: {
    captionMax: number;
    hashtagMax: number;
    mediaMax: number;
    mediaMimeAccepted: string[];
    aspectRatios: string[];
  };

  buildAuthorizationUrl(p: OAuthInitParams): string;
  exchangeCode(p: OAuthExchangeParams): Promise<OAuthTokens>;
  /** Optional — fetches a fresh token using the refresh token. Not every provider supports it. */
  refreshAccessToken?(refreshToken: string): Promise<OAuthTokens>;

  publish(args: { accessToken: string; externalAccountId: string; payload: PublishPayload }): Promise<PublishResult>;

  getAccountMetrics(args: { accessToken: string; externalAccountId: string }): Promise<MetricsSnapshot>;
  getPostMetrics?(args: { accessToken: string; externalPostId: string }): Promise<PostMetrics>;

  verifyWebhookSignature(args: { rawBody: Buffer; headers: Record<string, string | string[] | undefined> }): boolean;
}
