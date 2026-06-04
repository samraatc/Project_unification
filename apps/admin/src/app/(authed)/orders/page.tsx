'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface OrderRow {
  _id: string;
  number: string;
  status: string;
  totals: { total: number };
  currency: string;
  payment?: { method?: string; status?: string };
  createdAt: string;
}

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function OrdersPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiFetch<{ data: OrderRow[] }>('/orders', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold">Orders</h1>
      <p className="mt-1 text-text-secondary">Customer orders across every channel.</p>
      <div className="mt-6">
        {query.isLoading ? (
          <div className="skeleton h-48" aria-busy role="status" />
        ) : (
          <NeuCard className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.data ?? []).map((o) => (
                  <tr key={o._id} className="border-t border-surface-sunken/40">
                    <td className="px-4 py-3 font-mono text-xs">{o.number}</td>
                    <td className="px-4 py-3 capitalize">{o.status}</td>
                    <td className="px-4 py-3">
                      {o.payment?.method?.toUpperCase()} · {o.payment?.status}
                    </td>
                    <td className="px-4 py-3">{money(o.totals.total, o.currency)}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(query.data?.data?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                      No orders yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </NeuCard>
        )}
      </div>
    </div>
  );
}
