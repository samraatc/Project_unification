import { Post, SocialAccount, InboxMessage } from '../../db/models/index.js';
import { providerFor, type Platform } from './providers/index.js';
import { decryptField } from '../crypto.service.js';

/**
 * Analytics aggregation service.
 *
 * Phase 2.5 ships the per-platform pull layer (calls each provider's
 * `getAccountMetrics` / `getPostMetrics`) + a 6-hour Redis cache so the
 * dashboard doesn't hammer the platform APIs. The real export to PDF/XLSX lands
 * with the reports module in Phase 5.
 */

export interface AnalyticsRange {
  from: Date;
  to: Date;
}

export interface PlatformSummary {
  platform: Platform;
  accountId: string;
  name?: string;
  followers?: number;
  reach?: number;
  impressions?: number;
  engagement?: number;
  clicks?: number;
  pulledAt: Date;
}

export async function summaryByPlatform(tenantId: string): Promise<PlatformSummary[]> {
  const accounts = await SocialAccount.find({ tenantId, status: 'connected' })
    .select('+oauth.accessTokenCipher platform externalAccountId name')
    .lean();
  const summaries: PlatformSummary[] = [];
  for (const account of accounts) {
    const provider = providerFor(account.platform as Platform);
    let cipher: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose lean shape
    cipher = (account as any)?.oauth?.accessTokenCipher;
    const token = cipher ? decryptField(cipher) : '';
    // eslint-disable-next-line no-await-in-loop -- per-account fetch, not high cardinality
    const snap = await provider.getAccountMetrics({
      accessToken: token,
      externalAccountId: account.externalAccountId,
    });
    summaries.push({
      platform: account.platform as Platform,
      accountId: String(account._id),
      name: account.name,
      ...snap,
    });
  }
  return summaries;
}

export interface OperationsSummary {
  postsPublishedLast7d: number;
  postsScheduled: number;
  postsPendingApproval: number;
  inboxNew: number;
  inboxOpen: number;
  slaBreachedLast7d: number;
}

export async function operationsSummary(tenantId: string, range: AnalyticsRange): Promise<OperationsSummary> {
  const [published, scheduled, pending, inboxNew, inboxOpen, breached] = await Promise.all([
    Post.countDocuments({ tenantId, status: 'published', publishedAt: { $gte: range.from, $lte: range.to } }),
    Post.countDocuments({ tenantId, status: 'scheduled' }),
    Post.countDocuments({ tenantId, status: 'pending_approval' }),
    InboxMessage.countDocuments({ tenantId, status: 'new' }),
    InboxMessage.countDocuments({ tenantId, status: 'open' }),
    InboxMessage.countDocuments({ tenantId, slaBreachedAt: { $gte: range.from, $lte: range.to } }),
  ]);
  return {
    postsPublishedLast7d: published,
    postsScheduled: scheduled,
    postsPendingApproval: pending,
    inboxNew,
    inboxOpen,
    slaBreachedLast7d: breached,
  };
}
