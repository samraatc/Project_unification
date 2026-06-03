/**
 * Phase 2 — social hub smoke tests.
 *
 * Covers: per-platform format constraints, composer validation rejects an
 * over-limit caption, webhook signature verifier accepts a known good HMAC and
 * rejects tampered bodies.
 */
import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { validatePayload } from '../src/services/social/composer.service.js';
import { facebookProvider, instagramProvider, tiktokProvider } from '../src/services/social/providers/facebook.js';
import { providerFor, PLATFORMS } from '../src/services/social/providers/index.js';

void instagramProvider;
void tiktokProvider;

describe('platform format constraints', () => {
  it('exposes a strict TikTok video-only constraint', () => {
    const tt = providerFor('tiktok').formatConstraints;
    expect(tt.mediaMax).toBe(1);
    expect(tt.aspectRatios).toContain('9:16');
  });

  it('exposes 30-hashtag cap for Instagram', () => {
    const ig = providerFor('instagram').formatConstraints;
    expect(ig.hashtagMax).toBe(30);
    expect(ig.captionMax).toBe(2200);
  });
});

describe('composer validatePayload', () => {
  it('rejects an over-long caption per platform', () => {
    expect(() =>
      validatePayload('instagram', {
        caption: 'x'.repeat(3000),
        hashtags: [],
        mediaKeys: ['a'],
      }),
    ).toThrow(/CAPTION_TOO_LONG|2200/);
  });

  it('rejects too many media for TikTok', () => {
    expect(() =>
      validatePayload('tiktok', { caption: 'ok', hashtags: [], mediaKeys: ['a', 'b'] }),
    ).toThrow();
  });

  it('rejects too many hashtags for Instagram', () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`);
    expect(() => validatePayload('instagram', { caption: 'ok', hashtags: tags, mediaKeys: ['a'] })).toThrow();
  });
});

describe('Meta webhook signature', () => {
  const body = Buffer.from(JSON.stringify({ object: 'page', entry: [] }), 'utf8');
  const secret = process.env.META_APP_SECRET ?? 'dev-meta-app-secret';

  it('accepts a valid HMAC', () => {
    const mac = createHmac('sha256', secret).update(body).digest('hex');
    const ok = facebookProvider.verifyWebhookSignature({
      rawBody: body,
      headers: { 'x-hub-signature-256': `sha256=${mac}` },
    });
    expect(ok).toBe(true);
  });

  it('rejects a tampered body', () => {
    const mac = createHmac('sha256', secret).update(body).digest('hex');
    const ok = facebookProvider.verifyWebhookSignature({
      rawBody: Buffer.from('{"object":"hacked"}'),
      headers: { 'x-hub-signature-256': `sha256=${mac}` },
    });
    expect(ok).toBe(false);
  });

  it('rejects a missing signature header', () => {
    const ok = facebookProvider.verifyWebhookSignature({ rawBody: body, headers: {} });
    expect(ok).toBe(false);
  });
});

describe('provider registry', () => {
  it('returns a provider for every supported platform', () => {
    for (const p of PLATFORMS) {
      const provider = providerFor(p);
      expect(provider.platform).toBe(p);
      expect(provider.formatConstraints.captionMax).toBeGreaterThan(0);
    }
  });
});
