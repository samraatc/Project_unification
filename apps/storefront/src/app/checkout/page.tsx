'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { apiFetch, money } from '@/lib/api.js';

type Step = 'address' | 'delivery' | 'review' | 'payment' | 'confirmation';

interface Session {
  _id: string;
  step: Step;
  status: string;
  paymentMethod?: string;
}

const STEPS: Step[] = ['address', 'delivery', 'review', 'payment', 'confirmation'];

export default function CheckoutPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState({
    line1: '',
    city: '',
    country: 'NP',
    contactName: '',
    contactPhone: '',
  });
  const [delivery, setDelivery] = useState<'standard' | 'express' | 'pickup'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'esewa' | 'khalti' | 'paypal' | 'cod'>('stripe');
  const [gatewayInit, setGatewayInit] = useState<Record<string, unknown> | null>(null);

  async function start() {
    setError(null);
    try {
      const s = await apiFetch<Session>('/checkout/session', { method: 'POST', body: {} });
      setSession(s);
    } catch {
      setError('Could not start checkout. Is your cart empty?');
    }
  }

  async function submitAddress() {
    if (!session) return;
    const s = await apiFetch<Session>(`/checkout/session/${session._id}/address`, { method: 'PATCH', body: { address } });
    setSession(s);
  }
  async function submitDelivery() {
    if (!session) return;
    const s = await apiFetch<Session>(`/checkout/session/${session._id}/delivery`, { method: 'PATCH', body: { method: delivery } });
    setSession(s);
  }
  async function submitPayment() {
    if (!session) return;
    const res = await apiFetch<{ session: Session; gateway: Record<string, unknown> }>(
      `/checkout/session/${session._id}/payment`,
      { method: 'POST', body: { method: paymentMethod } },
    );
    setSession(res.session);
    setGatewayInit(res.gateway);
  }
  async function submitConfirm() {
    if (!session) return;
    // In dev the gateway is a stub — pass the providerRef back through.
    const gatewayRef = String((gatewayInit?.providerRef as string | undefined) ?? `dev-${Date.now()}`);
    const order = await apiFetch<{ number: string }>(`/checkout/session/${session._id}/confirm`, {
      method: 'POST',
      body: { gatewayRef },
    });
    router.push(`/orders/${order.number}`);
  }

  if (!session) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">Checkout</h1>
        <NeuCard className="mt-6">
          <p className="text-text-secondary">Ready to check out?</p>
          <div className="mt-4">
            <NeuButton onClick={start} size="lg">
              Start checkout
            </NeuButton>
          </div>
          {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
        </NeuCard>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>
      <ol className="mt-4 flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${
              STEPS.indexOf(session.step) >= i ? 'bg-brand-primary text-text-inverse' : 'shadow-neu-soft'
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {session.step === 'address' && (
          <NeuCard>
            <h2 className="text-lg font-semibold">Shipping address</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NeuInput label="Full name" value={address.contactName} onChange={(e) => setAddress({ ...address, contactName: e.target.value })} required />
              <NeuInput label="Phone" value={address.contactPhone} onChange={(e) => setAddress({ ...address, contactPhone: e.target.value })} required />
              <NeuInput label="Address line 1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} required />
              <NeuInput label="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
            </div>
            <div className="mt-6">
              <NeuButton onClick={submitAddress}>Continue</NeuButton>
            </div>
          </NeuCard>
        )}
        {session.step === 'delivery' && (
          <NeuCard>
            <h2 className="text-lg font-semibold">Delivery</h2>
            <div className="mt-4 space-y-2">
              {(['standard', 'express', 'pickup'] as const).map((m) => (
                <label key={m} className="flex items-center gap-3 rounded-md p-3 shadow-neu-soft">
                  <input type="radio" name="delivery" checked={delivery === m} onChange={() => setDelivery(m)} />
                  <span className="capitalize">{m}</span>
                </label>
              ))}
            </div>
            <div className="mt-6">
              <NeuButton onClick={submitDelivery}>Continue</NeuButton>
            </div>
          </NeuCard>
        )}
        {session.step === 'review' && (
          <NeuCard>
            <h2 className="text-lg font-semibold">Review</h2>
            <p className="mt-2 text-sm text-text-secondary">Confirm your cart on the next step (Payment).</p>
            <div className="mt-6">
              <NeuButton onClick={submitPayment}>Continue to payment</NeuButton>
            </div>
          </NeuCard>
        )}
        {session.step === 'payment' && (
          <NeuCard>
            <h2 className="text-lg font-semibold">Payment</h2>
            <div className="mt-4 space-y-2">
              {(['stripe', 'esewa', 'khalti', 'paypal', 'cod'] as const).map((m) => (
                <label key={m} className="flex items-center gap-3 rounded-md p-3 shadow-neu-soft">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} />
                  <span className="uppercase">{m}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <NeuButton onClick={submitPayment} variant="secondary">
                Re-initiate
              </NeuButton>
              <NeuButton onClick={submitConfirm} size="lg">
                Confirm order
              </NeuButton>
            </div>
            {gatewayInit ? (
              <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-surface-sunken p-3 text-xs">
                {JSON.stringify(gatewayInit, null, 2)}
              </pre>
            ) : null}
            <p className="mt-2 text-xs text-text-muted">
              Dev mode — gateways are stubbed; clicking Confirm finalises against the stub.
            </p>
          </NeuCard>
        )}
        {session.step === 'confirmation' && (
          <NeuCard>
            <h2 className="text-lg font-semibold">Order placed</h2>
            <p className="mt-2 text-sm text-text-secondary">Thanks — redirecting you to the order page.</p>
          </NeuCard>
        )}
      </div>

      <p className="mt-6 text-xs text-text-muted">{money(0)}</p>
    </section>
  );
}
