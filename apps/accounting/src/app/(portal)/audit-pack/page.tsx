'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface VerifyResult {
  valid: boolean;
  checked: number;
  firstBadAt?: string;
}

export default function AuditPackPage() {
  const { accessToken } = useAuth();
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 16));
  const [manifest, setManifest] = useState<unknown>(null);

  const verify = useQuery({
    queryKey: ['chain', 'verify'],
    queryFn: () => apiFetch<VerifyResult>('/accounting/audit-pack/chain/verify', { accessToken }),
    enabled: Boolean(accessToken),
  });

  const exportMut = useMutation({
    mutationFn: async () =>
      apiFetch('/accounting/audit-pack/export', {
        method: 'POST',
        accessToken,
        body: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
      }),
    onSuccess: (m) => setManifest(m),
  });

  return (
    <PremiumGate entitlement="accounting.audit_pack" feature="Audit pack">
      <h1 className="font-display text-2xl font-semibold">Audit pack</h1>

      <NeuCard className="mt-4">
        <h2 className="text-lg font-semibold">Chain integrity</h2>
        {verify.isLoading ? (
          <div className="skeleton mt-3 h-12" aria-busy role="status" />
        ) : (
          <p className={`mt-2 text-sm ${verify.data?.valid ? 'text-success' : 'text-error'}`}>
            {verify.data?.valid
              ? `Verified ${verify.data.checked} chained entries.`
              : `Chain broken at ${verify.data?.firstBadAt ?? '(unknown)'} after ${verify.data?.checked ?? 0} good entries.`}
          </p>
        )}
      </NeuCard>

      <NeuCard className="mt-4">
        <h2 className="text-lg font-semibold">Export</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <NeuInput label="From" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          <NeuInput label="To" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="self-end">
            <NeuButton onClick={() => exportMut.mutate()} loading={exportMut.isPending}>
              Build audit pack
            </NeuButton>
          </div>
        </div>
        {manifest ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-surface-sunken p-3 text-xs">
            {JSON.stringify(manifest, null, 2)}
          </pre>
        ) : null}
      </NeuCard>
    </PremiumGate>
  );
}
