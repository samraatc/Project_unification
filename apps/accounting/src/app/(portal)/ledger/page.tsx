'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { NeuButton, NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface CoaRow {
  _id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normalSide: 'dr' | 'cr';
  isSystem: boolean;
}

export default function LedgerPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [template, setTemplate] = useState<'retail' | 'services' | 'manufacturing'>('retail');

  const accounts = useQuery({
    queryKey: ['coa'],
    queryFn: () => apiFetch<{ data: CoaRow[] }>('/accounting/chart-of-accounts', { accessToken }),
    enabled: Boolean(accessToken),
  });

  const seed = useMutation({
    mutationFn: () => apiFetch('/accounting/chart-of-accounts/seed', { method: 'POST', accessToken, body: { template } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coa'] }),
  });

  return (
    <PremiumGate entitlement="accounting.ledger" feature="Ledger">
      <div className="space-y-6">
        <NeuCard>
          <h1 className="font-display text-2xl font-semibold">Chart of Accounts</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Seed one of the built-in templates to bootstrap your ledger, or add custom accounts.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as typeof template)}
              className="min-h-[44px] rounded-md bg-surface-sunken px-3 shadow-neu-sunken"
            >
              <option value="retail">Retail</option>
              <option value="services">Services</option>
              <option value="manufacturing">Manufacturing</option>
            </select>
            <NeuButton onClick={() => seed.mutate()} loading={seed.isPending}>
              Seed template
            </NeuButton>
          </div>
        </NeuCard>

        <NeuCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-text-secondary">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Side</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {(accounts.data?.data ?? []).map((a) => (
                <tr key={a._id} className="border-t border-surface-sunken/40">
                  <td className="px-4 py-3 font-mono">{a.code}</td>
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3 capitalize">{a.type}</td>
                  <td className="px-4 py-3 uppercase">{a.normalSide}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{a.isSystem ? 'template' : 'custom'}</td>
                </tr>
              ))}
              {(accounts.data?.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                    No accounts yet — seed a template to begin.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </NeuCard>
      </div>
    </PremiumGate>
  );
}
