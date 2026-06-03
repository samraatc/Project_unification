'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface UserRow {
  id: string;
  email?: string;
  phone?: string;
  status: string;
  firstName?: string;
  lastName?: string;
  lastLoginAt?: string;
  createdAt?: string;
}

export default function UsersPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: UserRow[] }>('/users', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold">Users</h1>
      <p className="mt-1 text-text-secondary">Invite, edit, and assign roles.</p>

      <div className="mt-8">
        {query.isLoading ? (
          <div className="skeleton h-48" aria-busy role="status" />
        ) : query.error ? (
          <NeuCard>
            <p className="text-error">Failed to load users.</p>
          </NeuCard>
        ) : (
          <NeuCard className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Identifier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last login</th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.data ?? []).map((u) => (
                  <tr key={u.id} className="border-t border-surface-sunken/40">
                    <td className="px-4 py-3">{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3">{u.email ?? u.phone ?? '—'}</td>
                    <td className="px-4 py-3 capitalize">{u.status}</td>
                    <td className="px-4 py-3">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {(query.data?.data?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                      No users yet.
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
