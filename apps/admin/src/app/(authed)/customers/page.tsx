'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface CustomerRow {
  _id: string;
  email?: string;
  phone?: string;
  profile?: { firstName?: string; lastName?: string };
  createdAt: string;
}

export default function CustomersPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiFetch<{ data: CustomerRow[] }>('/customers', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold">Customers</h1>
      <p className="mt-1 text-text-secondary">CRM Lite — profile, segments, tagging, communications.</p>
      <div className="mt-6">
        {query.isLoading ? (
          <div className="skeleton h-48" aria-busy role="status" />
        ) : (
          <NeuCard className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Identifier</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.data ?? []).map((u) => (
                  <tr key={u._id} className="border-t border-surface-sunken/40">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${u._id}`} className="underline">
                        {[u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ') || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{u.email ?? u.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{new Date(u.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </NeuCard>
        )}
      </div>
    </div>
  );
}
