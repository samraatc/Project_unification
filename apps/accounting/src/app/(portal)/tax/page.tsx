'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';
import { apiFetch, money } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface Vat200 {
  period: { from: string; to: string };
  salesTotal: number;
  vatOutput: number;
  vatInputClaim: number;
  netVatPayable: number;
  invoiceCount: number;
}

export default function TaxReturnsPage() {
  const { accessToken } = useAuth();
  const vat = useQuery({
    queryKey: ['tax', 'vat200'],
    queryFn: () => apiFetch<Vat200>('/accounting/tax/returns/vat200', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <PremiumGate entitlement="accounting.tax.vat200" feature="Tax returns">
      <h1 className="font-display text-2xl font-semibold">Tax returns</h1>

      <NeuCard className="mt-4">
        <h2 className="text-lg font-semibold">VAT 200 — Nepal IRD</h2>
        {vat.isLoading ? (
          <div className="skeleton mt-3 h-24" aria-busy role="status" />
        ) : !vat.data ? null : (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Sales total</dt>
              <dd className="font-medium">{money(vat.data.salesTotal, 'NPR')}</dd>
            </div>
            <div>
              <dt className="text-text-muted">VAT output</dt>
              <dd className="font-medium">{money(vat.data.vatOutput, 'NPR')}</dd>
            </div>
            <div>
              <dt className="text-text-muted">VAT input claim</dt>
              <dd className="font-medium">{money(vat.data.vatInputClaim, 'NPR')}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Net VAT payable</dt>
              <dd className="font-semibold">{money(vat.data.netVatPayable, 'NPR')}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-text-muted">Invoices in period</dt>
              <dd className="font-medium">{vat.data.invoiceCount}</dd>
            </div>
          </dl>
        )}
      </NeuCard>

      <NeuCard className="mt-4">
        <h2 className="text-lg font-semibold">GSTR-1 / GSTR-3B (India)</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Aggregations are wired; the regulator-exact CSV writer lands with the CA-discovery sign-off.
        </p>
      </NeuCard>
    </PremiumGate>
  );
}
