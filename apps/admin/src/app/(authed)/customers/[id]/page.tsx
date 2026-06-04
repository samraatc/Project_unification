'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface Profile {
  user: { _id: string; email?: string; phone?: string; profile?: { firstName?: string; lastName?: string } };
  tags: string[];
  segments: string[];
  stats: { orderCount: number; totalSpend: number; lastOrderAt?: string };
  communicationLog: Array<{ _id: string; channel: string; direction: string; subject?: string; body?: string; createdAt: string }>;
}

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState('');
  const [note, setNote] = useState('');

  const query = useQuery({
    queryKey: ['customer', params.id],
    queryFn: () => apiFetch<Profile>(`/customers/${params.id}`, { accessToken }),
    enabled: Boolean(accessToken),
  });

  const addTag = useMutation({
    mutationFn: async (tag: string) => apiFetch(`/customers/${params.id}/tags`, { method: 'POST', accessToken, body: { tag } }),
    onSuccess: () => {
      setNewTag('');
      void qc.invalidateQueries({ queryKey: ['customer', params.id] });
    },
  });

  const addNote = useMutation({
    mutationFn: async (body: string) =>
      apiFetch(`/customers/${params.id}/notes`, { method: 'POST', accessToken, body: { body } }),
    onSuccess: () => {
      setNote('');
      void qc.invalidateQueries({ queryKey: ['customer', params.id] });
    },
  });

  if (query.isLoading) return <div className="skeleton h-64" aria-busy role="status" />;
  if (!query.data) return <p>Customer not found.</p>;
  const p = query.data;
  const fullName = [p.user.profile?.firstName, p.user.profile?.lastName].filter(Boolean).join(' ') || '—';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
      <NeuCard>
        <h1 className="font-display text-2xl font-semibold">{fullName}</h1>
        <p className="mt-1 text-sm text-text-secondary">{p.user.email ?? p.user.phone ?? '—'}</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-text-muted">Orders</dt>
            <dd className="text-lg font-semibold">{p.stats.orderCount}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Lifetime spend</dt>
            <dd className="text-lg font-semibold">{money(p.stats.totalSpend ?? 0)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-text-muted">Last order</dt>
            <dd className="text-sm">{p.stats.lastOrderAt ? new Date(p.stats.lastOrderAt).toLocaleString() : '—'}</dd>
          </div>
        </dl>

        <h2 className="mt-6 text-sm font-semibold text-text-secondary">Segments</h2>
        <div className="mt-1 flex flex-wrap gap-2">
          {p.segments.length === 0 ? (
            <span className="text-xs text-text-muted">No segments</span>
          ) : (
            p.segments.map((s) => (
              <span key={s} className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs uppercase shadow-neu-soft">
                {s}
              </span>
            ))
          )}
        </div>

        <h2 className="mt-6 text-sm font-semibold text-text-secondary">Tags</h2>
        <div className="mt-1 flex flex-wrap gap-2">
          {p.tags.map((t) => (
            <span key={t} className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs text-brand-primary shadow-neu-soft">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <NeuInput value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="add tag…" />
          <NeuButton onClick={() => addTag.mutate(newTag)} disabled={!newTag} loading={addTag.isPending}>
            Add
          </NeuButton>
        </div>
      </NeuCard>

      <NeuCard>
        <h2 className="text-lg font-semibold">Communications</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {p.communicationLog.length === 0 ? (
            <li className="text-text-secondary">No comms logged yet.</li>
          ) : (
            p.communicationLog.map((c) => (
              <li key={c._id} className="rounded-md p-3 shadow-neu-soft">
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  {c.channel} · {c.direction} · {new Date(c.createdAt).toLocaleString()}
                </p>
                {c.subject ? <p className="mt-1 font-medium">{c.subject}</p> : null}
                {c.body ? <p className="mt-1 whitespace-pre-wrap">{c.body}</p> : null}
              </li>
            ))
          )}
        </ul>

        <h3 className="mt-6 text-sm font-semibold text-text-secondary">Add note</h3>
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full rounded-md bg-surface-sunken p-3 text-base shadow-neu-sunken focus:outline-none focus:ring-2 focus:ring-brand-primary"
            placeholder="Internal note about this customer…"
          />
          <NeuButton onClick={() => addNote.mutate(note)} disabled={!note} loading={addNote.isPending}>
            Save note
          </NeuButton>
        </div>
      </NeuCard>
    </div>
  );
}
