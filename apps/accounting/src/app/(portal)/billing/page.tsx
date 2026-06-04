'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { NeuButton, NeuCard } from '@unified/design-system';

import { apiFetch, money } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface Plan {
  code: 'trial' | 'monthly' | 'yearly' | 'lifetime' | 'enterprise';
  name: string;
  amountUsd: number;
  amountNpr: number;
  cycle: string;
  seats: number;
  bestFor?: string;
  trialDays?: number;
  entitlements: string[];
}

interface Subscription {
  status: string;
  plan?: string;
  currentPeriodEnd?: string;
  entitlements?: string[];
  gateway?: { provider?: string };
}

export default function BillingPage() {
  const { accessToken } = useAuth();
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch<{ data: Plan[] }>('/billing/plans'),
  });
  const sub = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiFetch<Subscription>('/billing/subscription', { accessToken }),
    enabled: Boolean(accessToken),
  });
  const checkout = useMutation({
    mutationFn: async (input: { plan: Plan['code']; provider: 'stripe' | 'esewa' | 'khalti' }) => {
      const res = await apiFetch<{ redirectUrl?: string; extra?: unknown }>('/billing/checkout', {
        method: 'POST',
        accessToken,
        body: {
          plan: input.plan,
          provider: input.provider,
          returnUrl: window.location.origin + '/billing?success=1',
          cancelUrl: window.location.origin + '/billing?cancelled=1',
          customer: {},
        },
      });
      if (res.redirectUrl) window.location.href = res.redirectUrl;
      return res;
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-semibold">Billing</h1>

      <NeuCard>
        <h2 className="text-lg font-semibold">Current subscription</h2>
        {sub.isLoading ? (
          <div className="skeleton mt-3 h-16" aria-busy role="status" />
        ) : (
          <div className="mt-3 text-sm">
            <p>
              Status — <span className="font-medium capitalize">{sub.data?.status}</span>
            </p>
            {sub.data?.plan ? <p>Plan — {sub.data.plan}</p> : null}
            {sub.data?.currentPeriodEnd ? (
              <p>Renews — {new Date(sub.data.currentPeriodEnd).toLocaleString()}</p>
            ) : null}
            {sub.data?.gateway?.provider ? <p>Provider — {sub.data.gateway.provider}</p> : null}
            <p className="mt-1 text-xs text-text-muted">
              {sub.data?.entitlements?.length ?? 0} entitlement(s) active.
            </p>
          </div>
        )}
      </NeuCard>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(plans.data?.data ?? []).map((p) => (
          <NeuCard key={p.code}>
            <h3 className="font-display text-lg font-semibold">{p.name}</h3>
            {p.bestFor ? <p className="mt-1 text-xs text-text-muted">{p.bestFor}</p> : null}
            <p className="mt-3 font-display text-2xl">
              {money(p.amountUsd, 'USD')}
              <span className="ml-1 text-xs text-text-muted">/ {p.cycle === 'none' ? p.cycle : `per ${p.cycle.replace('_', ' ')}`}</span>
            </p>
            <p className="text-xs text-text-muted">
              or {money(p.amountNpr, 'NPR')}
            </p>
            <ul className="mt-3 text-xs text-text-secondary">
              {p.entitlements.slice(0, 4).map((e) => (
                <li key={e}>• {e}</li>
              ))}
              {p.entitlements.length > 4 ? (
                <li className="text-text-muted">+ {p.entitlements.length - 4} more</li>
              ) : null}
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <NeuButton
                size="sm"
                onClick={() => checkout.mutate({ plan: p.code, provider: 'stripe' })}
                loading={checkout.isPending && checkout.variables?.plan === p.code && checkout.variables?.provider === 'stripe'}
              >
                Stripe
              </NeuButton>
              <NeuButton
                size="sm"
                variant="secondary"
                onClick={() => checkout.mutate({ plan: p.code, provider: 'esewa' })}
                loading={checkout.isPending && checkout.variables?.plan === p.code && checkout.variables?.provider === 'esewa'}
              >
                eSewa
              </NeuButton>
              <NeuButton
                size="sm"
                variant="secondary"
                onClick={() => checkout.mutate({ plan: p.code, provider: 'khalti' })}
                loading={checkout.isPending && checkout.variables?.plan === p.code && checkout.variables?.provider === 'khalti'}
              >
                Khalti
              </NeuButton>
            </div>
          </NeuCard>
        ))}
      </section>
    </div>
  );
}
