'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { NeuButton, NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch, money } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface BankAccount {
  _id: string;
  name: string;
  currency: string;
  lastReconciledAt?: string;
}

interface BankTxn {
  _id: string;
  bankAccountId: string;
  date: string;
  amountMinor: number;
  direction: 'debit' | 'credit';
  reference?: string;
  description?: string;
  status: string;
  matchConfidence?: number;
}

export default function BankPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const accounts = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => apiFetch<{ data: BankAccount[] }>('/accounting/bank/accounts', { accessToken }),
    enabled: Boolean(accessToken),
  });
  const txns = useQuery({
    queryKey: ['bankTxns'],
    queryFn: () => apiFetch<{ data: BankTxn[] }>('/accounting/bank/transactions', { accessToken }),
    enabled: Boolean(accessToken),
  });
  const autoMatch = useMutation({
    mutationFn: async (bankAccountId: string) =>
      apiFetch('/accounting/bank/auto-match', { method: 'POST', accessToken, body: { bankAccountId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bankTxns'] }),
  });

  return (
    <PremiumGate entitlement="accounting.bank_reconciliation" feature="Bank reconciliation">
      <h1 className="font-display text-2xl font-semibold">Bank reconciliation</h1>

      <NeuCard className="mt-4">
        <h2 className="text-lg font-semibold">Accounts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(accounts.data?.data ?? []).map((a) => (
            <li key={a._id} className="flex items-center justify-between rounded-md p-3 shadow-neu-soft">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-text-muted">
                  {a.currency} ·{' '}
                  {a.lastReconciledAt ? `reconciled ${new Date(a.lastReconciledAt).toLocaleDateString()}` : 'never reconciled'}
                </p>
              </div>
              <NeuButton size="sm" onClick={() => autoMatch.mutate(a._id)} loading={autoMatch.isPending}>
                Auto-match
              </NeuButton>
            </li>
          ))}
          {(accounts.data?.data?.length ?? 0) === 0 ? (
            <li className="text-text-secondary">No bank accounts yet.</li>
          ) : null}
        </ul>
      </NeuCard>

      <NeuCard className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {(txns.data?.data ?? []).map((t) => (
              <tr key={t._id} className="border-t border-surface-sunken/40">
                <td className="px-4 py-3 font-mono text-xs">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-4 py-3">{t.reference ?? t.description ?? '—'}</td>
                <td className={`px-4 py-3 text-right ${t.direction === 'credit' ? 'text-success' : ''}`}>
                  {money(t.amountMinor)}
                </td>
                <td className="px-4 py-3 capitalize">{t.status}</td>
                <td className="px-4 py-3 text-right">{t.matchConfidence ? Math.round(t.matchConfidence * 100) + '%' : '—'}</td>
              </tr>
            ))}
            {(txns.data?.data?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  No unmatched transactions.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </NeuCard>
    </PremiumGate>
  );
}
