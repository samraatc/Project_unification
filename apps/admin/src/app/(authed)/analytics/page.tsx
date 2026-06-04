'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface Overview {
  range: { from: string; to: string };
  sales: { revenue: number; orders: number; avgOrderValue: number; paidOrders: number };
  inventory: { lowStockSkus: number; outOfStockSkus: number };
  customers: { newCustomers: number; repeatCustomers: number };
  social: { postsPublished: number; inboxOpen: number; slaBreached: number };
}

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function AnalyticsOverviewPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => apiFetch<Overview>('/analytics/overview', { accessToken }),
    enabled: Boolean(accessToken),
  });

  if (query.isLoading) return <div className="skeleton h-64" aria-busy role="status" />;
  if (!query.data) return <p>Could not load analytics.</p>;
  const d = query.data;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl font-semibold">Sales (last 30 days)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Revenue" value={money(d.sales.revenue)} />
          <Kpi label="Orders" value={String(d.sales.orders)} />
          <Kpi label="Paid orders" value={String(d.sales.paidOrders)} />
          <Kpi label="Avg order value" value={money(d.sales.avgOrderValue)} />
        </div>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Inventory</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Kpi label="Low stock SKUs" value={String(d.inventory.lowStockSkus)} alert={d.inventory.lowStockSkus > 0} />
          <Kpi label="Out of stock SKUs" value={String(d.inventory.outOfStockSkus)} alert={d.inventory.outOfStockSkus > 0} />
        </div>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Customers</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Kpi label="New customers" value={String(d.customers.newCustomers)} />
          <Kpi label="Repeat customers" value={String(d.customers.repeatCustomers)} />
        </div>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Social</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Posts published" value={String(d.social.postsPublished)} />
          <Kpi label="Inbox open" value={String(d.social.inboxOpen)} />
          <Kpi label="SLA breached" value={String(d.social.slaBreached)} alert={d.social.slaBreached > 0} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <NeuCard dense>
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${alert ? 'text-error' : ''}`}>{value}</p>
    </NeuCard>
  );
}
