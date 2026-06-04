'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface CouponRow {
  _id: string;
  code: string;
  type: 'percentage' | 'flat' | 'free_ship' | 'bogo';
  value: number;
  usageCount: number;
  usageLimit?: number;
  status: string;
  startsAt?: string;
  endsAt?: string;
}

export default function CouponsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['catalogue', 'coupons'],
    queryFn: () => apiFetch<{ data: CouponRow[] }>('/coupons', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div>
      {query.isLoading ? (
        <div className="skeleton h-48" aria-busy role="status" />
      ) : (
        <NeuCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.data ?? []).map((c) => (
                <tr key={c._id} className="border-t border-surface-sunken/40">
                  <td className="px-4 py-3 font-mono">{c.code}</td>
                  <td className="px-4 py-3 capitalize">{c.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{c.value}</td>
                  <td className="px-4 py-3">
                    {c.usageCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 capitalize">{c.status}</td>
                </tr>
              ))}
              {(query.data?.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                    No coupons yet.
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
