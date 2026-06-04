'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface CRMAnalytics {
  totals: { customers: number; newInRange: number; activeInRange: number };
  spendBuckets: Array<{ bucket: string; customers: number }>;
  topSpenders: Array<{ userId: string; email?: string; phone?: string; spend: number; orders: number }>;
  recentCommunications: number;
}

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function CustomersAnalyticsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['analytics', 'customers'],
    queryFn: () => apiFetch<CRMAnalytics>('/analytics/customers', { accessToken }),
    enabled: Boolean(accessToken),
  });
  if (query.isLoading) return <div className="skeleton h-64" aria-busy role="status" />;
  if (!query.data) return <p>No data.</p>;
  const d = query.data;

  const max = Math.max(1, ...d.spendBuckets.map((b) => b.customers));

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total customers" value={String(d.totals.customers)} />
        <Kpi label="New (in range)" value={String(d.totals.newInRange)} />
        <Kpi label="Active (in range)" value={String(d.totals.activeInRange)} />
        <Kpi label="Comms touches" value={String(d.recentCommunications)} />
      </section>

      <NeuCard>
        <h2 className="text-lg font-semibold">Spend distribution</h2>
        <ul className="mt-4 space-y-2">
          {d.spendBuckets.map((b) => (
            <li key={b.bucket} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
              <span>{b.bucket}</span>
              <div className="h-3 rounded bg-surface-sunken">
                <div className="h-3 rounded bg-brand-primary" style={{ width: `${Math.round((b.customers / max) * 100)}%` }} />
              </div>
              <span className="text-right">{b.customers}</span>
            </li>
          ))}
        </ul>
      </NeuCard>

      <NeuCard>
        <h2 className="text-lg font-semibold">Top spenders</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {d.topSpenders.map((s) => (
            <li key={s.userId} className="flex items-center justify-between">
              <span className="truncate">{s.email ?? s.phone ?? s.userId.slice(-8)}</span>
              <span className="text-text-muted">
                {s.orders} orders · {money(s.spend)}
              </span>
            </li>
          ))}
        </ol>
      </NeuCard>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <NeuCard dense>
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </NeuCard>
  );
}
