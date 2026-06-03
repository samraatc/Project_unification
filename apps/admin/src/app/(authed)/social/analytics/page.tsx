'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface AnalyticsResponse {
  range: { from: string; to: string };
  platforms: Array<{
    platform: 'facebook' | 'instagram' | 'tiktok';
    name?: string;
    followers?: number;
    reach?: number;
    impressions?: number;
    engagement?: number;
    clicks?: number;
  }>;
  operations: {
    postsPublishedLast7d: number;
    postsScheduled: number;
    postsPendingApproval: number;
    inboxNew: number;
    inboxOpen: number;
    slaBreachedLast7d: number;
  };
}

export default function AnalyticsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['social', 'analytics'],
    queryFn: () => apiFetch<AnalyticsResponse>('/social/analytics', { accessToken }),
    enabled: Boolean(accessToken),
  });

  if (query.isLoading) {
    return <div className="skeleton h-64" aria-busy role="status" />;
  }
  if (!query.data) return null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl font-semibold">Operations (last 7 days)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Published', value: query.data.operations.postsPublishedLast7d },
            { label: 'Scheduled', value: query.data.operations.postsScheduled },
            { label: 'Pending approval', value: query.data.operations.postsPendingApproval },
            { label: 'Inbox · new', value: query.data.operations.inboxNew },
            { label: 'Inbox · open', value: query.data.operations.inboxOpen },
            { label: 'SLA breached', value: query.data.operations.slaBreachedLast7d, alert: true },
          ].map((kpi) => (
            <NeuCard key={kpi.label} dense>
              <p className="text-xs uppercase tracking-wide text-text-muted">{kpi.label}</p>
              <p
                className={`mt-2 font-display text-3xl font-semibold ${kpi.alert && kpi.value > 0 ? 'text-error' : ''}`}
              >
                {kpi.value}
              </p>
            </NeuCard>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Per platform</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {query.data.platforms.map((p) => (
            <NeuCard key={`${p.platform}-${p.name}`}>
              <p className="text-xs uppercase tracking-wide text-text-muted">{p.platform}</p>
              <h3 className="mt-1 text-lg font-semibold">{p.name ?? '—'}</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-text-muted">Followers</dt>
                  <dd>{p.followers?.toLocaleString() ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Reach</dt>
                  <dd>{p.reach?.toLocaleString() ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Impressions</dt>
                  <dd>{p.impressions?.toLocaleString() ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Engagement</dt>
                  <dd>{p.engagement?.toLocaleString() ?? '—'}</dd>
                </div>
              </dl>
            </NeuCard>
          ))}
        </div>
      </section>
    </div>
  );
}
