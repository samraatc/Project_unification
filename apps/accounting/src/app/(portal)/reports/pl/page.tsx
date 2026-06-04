'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch, money } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface PL {
  revenue: number;
  expense: number;
  netIncome: number;
  accounts: Array<{ code: string; name: string; balance: number; type: string }>;
}

export default function ProfitAndLossPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['pl'],
    queryFn: () => apiFetch<PL>('/accounting/reports/pl', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <PremiumGate entitlement="accounting.reports.pl" feature="Profit & Loss">
      <h1 className="font-display text-2xl font-semibold">Profit &amp; Loss</h1>
      {query.isLoading ? (
        <div className="skeleton mt-4 h-32" aria-busy role="status" />
      ) : !query.data ? null : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <NeuCard dense>
            <p className="text-xs uppercase tracking-wide text-text-muted">Revenue</p>
            <p className="mt-1 font-display text-2xl font-semibold">{money(query.data.revenue)}</p>
          </NeuCard>
          <NeuCard dense>
            <p className="text-xs uppercase tracking-wide text-text-muted">Expense</p>
            <p className="mt-1 font-display text-2xl font-semibold">{money(query.data.expense)}</p>
          </NeuCard>
          <NeuCard dense>
            <p className="text-xs uppercase tracking-wide text-text-muted">Net income</p>
            <p className={`mt-1 font-display text-2xl font-semibold ${query.data.netIncome < 0 ? 'text-error' : 'text-success'}`}>
              {money(query.data.netIncome)}
            </p>
          </NeuCard>
        </div>
      )}
    </PremiumGate>
  );
}
