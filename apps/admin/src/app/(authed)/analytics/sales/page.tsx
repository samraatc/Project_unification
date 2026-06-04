'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface SalesResponse {
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ productId: string; name: string; revenue: number; units: number }>;
  paymentMethodSplit: Array<{ method: string; orders: number; revenue: number }>;
  fulfilmentSummary: Array<{ status: string; orders: number }>;
}

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function SalesAnalyticsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['analytics', 'sales'],
    queryFn: () => apiFetch<SalesResponse>('/analytics/sales', { accessToken }),
    enabled: Boolean(accessToken),
  });

  if (query.isLoading) return <div className="skeleton h-64" aria-busy role="status" />;
  if (!query.data) return <p>No data.</p>;
  const d = query.data;

  // Lightweight inline bar chart — Recharts wires in once the dep installs.
  const max = Math.max(1, ...d.revenueByDay.map((r) => r.revenue));

  return (
    <div className="space-y-8">
      <NeuCard>
        <h2 className="text-lg font-semibold">Revenue by day</h2>
        <ul className="mt-4 space-y-2">
          {d.revenueByDay.length === 0 ? (
            <li className="text-sm text-text-secondary">No paid orders in window.</li>
          ) : (
            d.revenueByDay.map((row) => (
              <li key={row.date} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
                <span className="font-mono text-xs text-text-muted">{row.date}</span>
                <div className="h-3 rounded bg-surface-sunken">
                  <div
                    className="h-3 rounded bg-brand-primary"
                    style={{ width: `${Math.round((row.revenue / max) * 100)}%` }}
                  />
                </div>
                <span className="text-sm">{money(row.revenue)}</span>
              </li>
            ))
          )}
        </ul>
      </NeuCard>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <NeuCard>
          <h2 className="text-lg font-semibold">Top products</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {d.topProducts.map((p) => (
              <li key={p.productId} className="flex items-center justify-between">
                <span className="truncate">{p.name}</span>
                <span className="text-text-muted">
                  {p.units} units · {money(p.revenue)}
                </span>
              </li>
            ))}
          </ol>
        </NeuCard>

        <NeuCard>
          <h2 className="text-lg font-semibold">Payment method split</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {d.paymentMethodSplit.map((m) => (
              <li key={m.method} className="flex items-center justify-between">
                <span className="uppercase">{m.method}</span>
                <span className="text-text-muted">{m.orders} orders · {money(m.revenue)}</span>
              </li>
            ))}
          </ul>
        </NeuCard>
      </div>

      <NeuCard>
        <h2 className="text-lg font-semibold">Fulfilment summary</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {d.fulfilmentSummary.map((f) => (
            <div key={f.status} className="rounded-md p-3 shadow-neu-soft">
              <p className="text-xs uppercase tracking-wide text-text-muted">{f.status}</p>
              <p className="mt-1 font-display text-xl font-semibold">{f.orders}</p>
            </div>
          ))}
        </div>
      </NeuCard>
    </div>
  );
}
