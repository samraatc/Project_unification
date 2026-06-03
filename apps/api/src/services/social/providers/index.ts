import { facebookProvider } from './facebook.js';
import { instagramProvider } from './instagram.js';
import { tiktokProvider } from './tiktok.js';
import type { Platform, SocialProvider } from './types.js';

export type { Platform, SocialProvider, OAuthTokens, PublishPayload, PublishResult, MetricsSnapshot, PostMetrics } from './types.js';

const REGISTRY: Record<Platform, SocialProvider> = {
  facebook: facebookProvider,
  instagram: instagramProvider,
  tiktok: tiktokProvider,
};

export function providerFor(platform: Platform): SocialProvider {
  const p = REGISTRY[platform];
  if (!p) throw new Error(`No provider for platform ${platform}`);
  return p;
}

export const PLATFORMS: readonly Platform[] = ['facebook', 'instagram', 'tiktok'];
