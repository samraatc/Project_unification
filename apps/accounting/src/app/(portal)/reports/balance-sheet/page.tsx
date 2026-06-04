'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch, money } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface BS {
  asOf: string;
  assets: number;
  liabilities: number;
  equity: number;
  balanced: boolean;
}

export default function BalanceSheetPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['bs'],
    queryFn: () => apiFetch<BS>('/accounting/reports/balance-sheet', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <PremiumGate entitlement="accounting.reports.balance_sheet" feature="Balance sheet">
      <h1 className="font-display text-2xl font-semibold">Balance sheet</h1>
      {query.isLoading ? (
        <div className="skeleton mt-4 h-32" aria-busy role="status" />
      ) : !query.data ? null : (
        <div className="mt-4 space-y-4">
          <p className={`text-sm ${query.data.balanced ? 'text-success' : 'text-error'}`}>
            {query.data.balanced ? 'Assets = Liabilities + Equity' : 'OUT OF BALANCE'} · as of{' '}
            {new Date(query.data.asOf).toLocaleString()}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <NeuCard dense>
              <p className="text-xs uppercase tracking-wide text-text-muted">Assets</p>
              <p className="mt-1 font-display text-2xl font-semibold">{money(query.data.assets)}</p>
            </NeuCard>
            <NeuCard dense>
              <p className="text-xs uppercase tracking-wide text-text-muted">Liabilities</p>
              <p className="mt-1 font-display text-2xl font-semibold">{money(query.data.liabilities)}</p>
            </NeuCard>
            <NeuCard dense>
              <p className="text-xs uppercase tracking-wide text-text-muted">Equity</p>
              <p className="mt-1 font-display text-2xl font-semibold">{money(query.data.equity)}</p>
            </NeuCard>
          </div>
        </div>
      )}
    </PremiumGate>
  );
}
