'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface InventoryRow {
  _id: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
}

export default function InventoryPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['inventory'],
    queryFn: () => apiFetch<{ data: InventoryRow[] }>('/inventory', { accessToken }),
    enabled: Boolean(accessToken),
  });

  const low = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => apiFetch<{ data: InventoryRow[] }>('/inventory/low-stock', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Inventory</h1>
      {(low.data?.data?.length ?? 0) > 0 ? (
        <NeuCard>
          <h2 className="text-lg font-semibold text-error">Low stock</h2>
          <ul className="mt-2 text-sm">
            {low.data?.data?.map((r) => (
              <li key={r._id} className="flex justify-between py-1">
                <span className="font-mono">{r.sku}</span>
                <span>
                  {r.available} / threshold {r.threshold}
                </span>
              </li>
            ))}
          </ul>
        </NeuCard>
      ) : null}

      {query.isLoading ? (
        <div className="skeleton h-64" aria-busy role="status" />
      ) : (
        <NeuCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Reserved</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.data ?? []).map((r) => (
                <tr key={r._id} className="border-t border-surface-sunken/40">
                  <td className="px-4 py-3 font-mono">{r.sku}</td>
                  <td className="px-4 py-3">{r.onHand}</td>
                  <td className="px-4 py-3">{r.reserved}</td>
                  <td className={`px-4 py-3 ${r.available <= r.threshold ? 'text-error' : ''}`}>{r.available}</td>
                  <td className="px-4 py-3">{r.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </NeuCard>
      )}
    </div>
  );
}
