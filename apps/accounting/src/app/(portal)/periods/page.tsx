'use client';

import { NeuCard } from '@unified/design-system';

import { PremiumGate } from '@/components/PremiumGate.js';

export default function PeriodsPage() {
  return (
    <PremiumGate entitlement="accounting.period_close" feature="Period close">
      <h1 className="font-display text-2xl font-semibold">Period close</h1>
      <NeuCard className="mt-4">
        <p className="text-sm text-text-secondary">
          Create monthly / quarterly / yearly periods, close them to lock new journal posts, and
          reopen with Super Admin sign-off. The accounting worker writes the tamper-evident
          chain hash on every premium audit event.
        </p>
      </NeuCard>
    </PremiumGate>
  );
}
