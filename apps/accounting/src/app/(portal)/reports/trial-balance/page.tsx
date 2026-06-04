'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch, money } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface TB {
  asOf: string;
  accounts: Array<{ code: string; name: string; debit: number; credit: number; balance: number; type: string }>;
  totals: { debit: number; credit: number; balanced: boolean };
}

export default function TrialBalancePage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['tb'],
    queryFn: () => apiFetch<TB>('/accounting/reports/trial-balance', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <PremiumGate entitlement="accounting.reports.trial_balance" feature="Trial balance">
      <h1 className="font-display text-2xl font-semibold">Trial balance</h1>
      {query.isLoading ? (
        <div className="skeleton mt-4 h-64" aria-busy role="status" />
      ) : !query.data ? null : (
        <>
          <p className="mt-2 text-sm text-text-secondary">
            As of {new Date(query.data.asOf).toLocaleString()} ·{' '}
            <span className={query.data.totals.balanced ? 'text-success' : 'text-error'}>
              {query.data.totals.balanced ? 'Balanced' : 'OUT OF BALANCE'}
            </span>
          </p>
          <NeuCard className="mt-4 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {query.data.accounts.map((a) => (
                  <tr key={a.code} className="border-t border-surface-sunken/40">
                    <td className="px-4 py-3 font-mono">{a.code}</td>
                    <td className="px-4 py-3">{a.name}</td>
                    <td className="px-4 py-3 text-right">{money(a.debit)}</td>
                    <td className="px-4 py-3 text-right">{money(a.credit)}</td>
                    <td className="px-4 py-3 text-right">{money(a.balance)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-surface-sunken font-semibold">
                  <td className="px-4 py-3" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right">{money(query.data.totals.debit)}</td>
                  <td className="px-4 py-3 text-right">{money(query.data.totals.credit)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </NeuCard>
        </>
      )}
    </PremiumGate>
  );
}
