'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { NeuButton, NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface SocialAccount {
  _id: string;
  platform: 'facebook' | 'instagram' | 'tiktok';
  externalAccountId: string;
  name?: string;
  handle?: string;
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  connectedAt?: string;
}

const PLATFORMS: Array<{ key: 'facebook' | 'instagram' | 'tiktok'; label: string; color: string }> = [
  { key: 'facebook', label: 'Facebook Page', color: 'bg-blue-100' },
  { key: 'instagram', label: 'Instagram Business', color: 'bg-pink-100' },
  { key: 'tiktok', label: 'TikTok', color: 'bg-zinc-100' },
];

export default function SocialAccountsPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['social', 'accounts'],
    queryFn: () => apiFetch<{ data: SocialAccount[] }>('/social/accounts', { accessToken }),
    enabled: Boolean(accessToken),
  });

  const connect = useMutation({
    mutationFn: async (platform: SocialAccount['platform']) => {
      const res = await apiFetch<{ authorizationUrl: string }>(`/social/accounts/${platform}/connect`, {
        method: 'POST',
        accessToken,
      });
      window.location.href = res.authorizationUrl;
    },
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => apiFetch(`/social/accounts/${id}`, { method: 'DELETE', accessToken }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'accounts'] }),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLATFORMS.map((p) => (
          <NeuCard key={p.key}>
            <h2 className="text-lg font-semibold">{p.label}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Connect a {p.label} account to publish, schedule, and reply from one console.
            </p>
            <div className="mt-4">
              <NeuButton onClick={() => connect.mutate(p.key)} loading={connect.isPending && connect.variables === p.key}>
                Connect
              </NeuButton>
            </div>
          </NeuCard>
        ))}
      </div>

      <h2 className="font-display text-xl font-semibold">Connected accounts</h2>
      {query.isLoading ? (
        <div className="skeleton h-32" aria-busy role="status" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(query.data?.data ?? []).map((a) => (
            <NeuCard key={a._id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-mono uppercase tracking-wide text-text-muted">{a.platform}</p>
                  <h3 className="text-lg font-semibold">{a.name ?? a.externalAccountId}</h3>
                  {a.handle ? <p className="text-sm text-text-secondary">@{a.handle}</p> : null}
                  <p className="mt-2 text-xs text-text-muted">
                    Connected {a.connectedAt ? new Date(a.connectedAt).toLocaleString() : '—'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs shadow-neu-soft ${
                    a.status === 'connected' ? 'text-success' : 'text-error'
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <div className="mt-4">
                <NeuButton variant="ghost" size="sm" onClick={() => disconnect.mutate(a._id)}>
                  Disconnect
                </NeuButton>
              </div>
            </NeuCard>
          ))}
          {(query.data?.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-secondary">No accounts connected yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
