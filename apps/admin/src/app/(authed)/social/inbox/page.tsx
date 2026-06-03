'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface InboxRow {
  _id: string;
  platform: 'facebook' | 'instagram' | 'tiktok';
  status: 'new' | 'open' | 'responded' | 'closed';
  authorHandle?: string;
  body: string;
  receivedAt: string;
  slaDueAt?: string;
  slaBreachedAt?: string;
}

export default function InboxPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<InboxRow | null>(null);
  const [reply, setReply] = useState('');

  const list = useQuery({
    queryKey: ['social', 'inbox', 'new+open'],
    queryFn: () => apiFetch<{ data: InboxRow[] }>('/social/inbox?status=new', { accessToken }),
    enabled: Boolean(accessToken),
    refetchInterval: 15_000,
  });

  const replyMut = useMutation({
    mutationFn: async () => {
      if (!active) return null;
      return apiFetch(`/social/inbox/${active._id}/reply`, {
        method: 'POST',
        accessToken,
        body: { body: reply },
      });
    },
    onSuccess: () => {
      setReply('');
      void qc.invalidateQueries({ queryKey: ['social', 'inbox', 'new+open'] });
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
      <NeuCard className="overflow-hidden p-0">
        <ul className="divide-y divide-surface-sunken/50">
          {list.isLoading ? (
            <li className="p-4">
              <div className="skeleton h-12" aria-busy role="status" />
            </li>
          ) : (list.data?.data ?? []).length === 0 ? (
            <li className="p-4 text-sm text-text-secondary">No new messages.</li>
          ) : (
            (list.data?.data ?? []).map((row) => {
              const breached = row.slaBreachedAt
                ? true
                : row.slaDueAt && new Date(row.slaDueAt) < new Date();
              return (
                <li key={row._id}>
                  <button
                    onClick={() => setActive(row)}
                    className={`flex w-full flex-col items-start gap-1 p-4 text-left transition-shadow ${
                      active?._id === row._id ? 'bg-surface-sunken shadow-neu-sunken' : 'hover:shadow-neu-soft'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <p className="text-sm font-medium">{row.authorHandle ?? 'Unknown'}</p>
                      <span className="text-xs uppercase tracking-wide text-text-muted">{row.platform}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-text-secondary">{row.body}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted">{new Date(row.receivedAt).toLocaleString()}</span>
                      {breached ? <span className="text-error">SLA breached</span> : null}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </NeuCard>

      <NeuCard>
        {active ? (
          <>
            <h3 className="text-lg font-semibold">{active.authorHandle ?? 'Unknown'}</h3>
            <p className="text-xs uppercase tracking-wide text-text-muted">
              {active.platform} · {new Date(active.receivedAt).toLocaleString()}
            </p>
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-surface-sunken p-4 text-sm shadow-neu-sunken">
              {active.body}
            </p>

            <div className="mt-4 space-y-3">
              <NeuInput
                label="Reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply…"
              />
              <NeuButton onClick={() => replyMut.mutate()} loading={replyMut.isPending} disabled={!reply}>
                Send reply
              </NeuButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-text-secondary">Select a message to reply.</p>
        )}
      </NeuCard>
    </div>
  );
}
