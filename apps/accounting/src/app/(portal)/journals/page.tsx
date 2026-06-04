'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch, money } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface JournalRow {
  _id: string;
  number: string;
  postedAt: string;
  source: string;
  description: string;
  status: string;
  lines: Array<{ side: 'dr' | 'cr'; amountMinor: number; currency: string; memo?: string }>;
}

export default function JournalsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['journals'],
    queryFn: () => apiFetch<{ data: JournalRow[] }>('/accounting/journal-entries?limit=50', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <PremiumGate entitlement="accounting.journals" feature="Journals">
      <h1 className="font-display text-2xl font-semibold">Journal entries</h1>
      {query.isLoading ? (
        <div className="skeleton mt-4 h-64" aria-busy role="status" />
      ) : (
        <ul className="mt-6 space-y-3">
          {(query.data?.data ?? []).map((r) => {
            const dr = r.lines.filter((l) => l.side === 'dr').reduce((s, l) => s + l.amountMinor, 0);
            return (
              <li key={r._id}>
                <NeuCard>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm">{r.number}</p>
                    <p className="text-xs uppercase tracking-wide text-text-muted">{r.source}</p>
                  </div>
                  <p className="mt-1 text-sm">{r.description}</p>
                  <p className="mt-2 text-xs text-text-muted">
                    {new Date(r.postedAt).toLocaleString()} · {money(dr, r.lines[0]?.currency ?? 'USD')} ·{' '}
                    {r.lines.length} lines · {r.status}
                  </p>
                </NeuCard>
              </li>
            );
          })}
          {(query.data?.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-secondary">No entries yet.</p>
          ) : null}
        </ul>
      )}
    </PremiumGate>
  );
}
