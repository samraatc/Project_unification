'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface ProductRow {
  _id: string;
  sku: string;
  name: string;
  basePrice: number;
  currency: string;
  rating?: { avg: number; count: number };
}

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function ProductsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['catalogue', 'products'],
    queryFn: () => apiFetch<{ data: ProductRow[] }>('/products?limit=60', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div>
      {query.isLoading ? (
        <div className="skeleton h-64" aria-busy role="status" />
      ) : (
        <NeuCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Rating</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.data ?? []).map((p) => (
                <tr key={p._id} className="border-t border-surface-sunken/40">
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{money(p.basePrice, p.currency)}</td>
                  <td className="px-4 py-3">
                    {p.rating?.count ? `★ ${p.rating.avg.toFixed(1)} (${p.rating.count})` : '—'}
                  </td>
                </tr>
              ))}
              {(query.data?.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                    No products yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </NeuCard>
      )}
    </div>
  );
}
