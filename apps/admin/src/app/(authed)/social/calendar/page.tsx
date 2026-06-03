'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface PostRow {
  _id: string;
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  content: string;
  targets: { platform: string; status: string }[];
  createdAt: string;
}

export default function CalendarPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['social', 'posts', 'scheduled'],
    queryFn: () => apiFetch<{ data: PostRow[] }>('/social/posts?status=scheduled', { accessToken }),
    enabled: Boolean(accessToken),
  });
  const drafts = useQuery({
    queryKey: ['social', 'posts', 'draft'],
    queryFn: () => apiFetch<{ data: PostRow[] }>('/social/posts?status=draft', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="space-y-8">
      <Section title="Scheduled" rows={query.data?.data ?? []} loading={query.isLoading} timeField="scheduledAt" />
      <Section title="Drafts" rows={drafts.data?.data ?? []} loading={drafts.isLoading} timeField="createdAt" />
    </div>
  );
}

function Section({
  title,
  rows,
  loading,
  timeField,
}: {
  title: string;
  rows: PostRow[];
  loading: boolean;
  timeField: 'scheduledAt' | 'createdAt' | 'publishedAt';
}) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {loading ? (
        <div className="skeleton mt-3 h-32" aria-busy role="status" />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">No {title.toLowerCase()} posts.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((p) => {
            const when = p[timeField];
            return (
              <NeuCard key={p._id}>
                <p className="text-xs text-text-muted">{when ? new Date(when).toLocaleString() : '—'}</p>
                <p className="mt-2 line-clamp-3 text-sm">{p.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.targets.map((t, i) => (
                    <span key={i} className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs shadow-neu-soft">
                      {t.platform}
                    </span>
                  ))}
                </div>
              </NeuCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
