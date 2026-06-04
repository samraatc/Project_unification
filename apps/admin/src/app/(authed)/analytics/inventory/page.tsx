'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface InventoryAnalytics {
  totalSkus: number;
  totalUnitsOnHand: number;
  totalUnitsReserved: number;
  estimatedValue: number;
  lowStock: Array<{ sku: string; available: number; threshold: number; productName?: string }>;
  outOfStock: Array<{ sku: string; productName?: string }>;
}

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function InventoryAnalyticsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['analytics', 'inventory'],
    queryFn: () => apiFetch<InventoryAnalytics>('/analytics/inventory', { accessToken }),
    enabled: Boolean(accessToken),
  });
  if (query.isLoading) return <div className="skeleton h-64" aria-busy role="status" />;
  if (!query.data) return <p>No data.</p>;
  const d = query.data;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total SKUs" value={String(d.totalSkus)} />
        <Kpi label="Units on hand" value={String(d.totalUnitsOnHand)} />
        <Kpi label="Units reserved" value={String(d.totalUnitsReserved)} />
        <Kpi label="Estimated value" value={money(d.estimatedValue)} />
      </section>

      <NeuCard>
        <h2 className="text-lg font-semibold text-error">Low stock</h2>
        {d.lowStock.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">Nothing below threshold.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {d.lowStock.map((r) => (
              <li key={r.sku} className="flex items-center justify-between">
                <span>
                  <span className="font-mono">{r.sku}</span>
                  {r.productName ? <span className="text-text-muted"> · {r.productName}</span> : null}
                </span>
                <span>{r.available} / threshold {r.threshold}</span>
              </li>
            ))}
          </ul>
        )}
      </NeuCard>

      <NeuCard>
        <h2 className="text-lg font-semibold">Out of stock</h2>
        {d.outOfStock.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">No SKUs out of stock.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {d.outOfStock.map((r) => (
              <li key={r.sku} className="font-mono">
                {r.sku}
              </li>
            ))}
          </ul>
        )}
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
