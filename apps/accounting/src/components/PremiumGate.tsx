'use client';

import Link from 'next/link';

import { NeuButton, NeuCard } from '@unified/design-system';

import { useEntitlement } from '@/lib/auth-store.js';

/**
 * Wraps a premium feature surface. If the tenant doesn't have the entitlement,
 * shows the upgrade prompt the brief calls for ("locked features show an
 * upgrade prompt rather than an error").
 */
export function PremiumGate({
  entitlement,
  feature,
  children,
}: {
  entitlement: string;
  feature: string;
  children: React.ReactNode;
}) {
  const ok = useEntitlement(entitlement);
  if (ok) return <>{children}</>;
  return (
    <NeuCard>
      <h2 className="font-display text-2xl font-semibold">{feature} is a premium feature</h2>
      <p className="mt-2 text-text-secondary">
        Activate a subscription to unlock {feature.toLowerCase()} and the rest of the premium
        accounting suite. The 14-day Free Trial includes the core ledger; the Yearly plan adds
        the Tax module.
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/billing">
          <NeuButton>See plans</NeuButton>
        </Link>
      </div>
    </NeuCard>
  );
}
