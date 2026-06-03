'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface AuditEntry {
  _id: string;
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  ts: string;
  ip?: string;
}

export default function AuditPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['audit'],
    queryFn: () => apiFetch<{ data: AuditEntry[] }>('/audit?limit=50', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold">Audit log</h1>
      <p className="mt-1 text-text-secondary">
        Every mutation across the platform. Stored on a dedicated cluster (D-0002).
      </p>

      <div className="mt-8">
        {query.isLoading ? (
          <div className="skeleton h-64" aria-busy role="status" />
        ) : (
          <NeuCard className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {(query.data?.data ?? []).map((row) => (
                  <tr key={row._id} className="border-t border-surface-sunken/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">
                      {new Date(row.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                    <td className="px-4 py-3">
                      {row.entity}
                      {row.entityId ? <span className="text-text-muted"> · {row.entityId.slice(-6)}</span> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.actorId?.slice(-8) ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.ip ?? '—'}</td>
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
