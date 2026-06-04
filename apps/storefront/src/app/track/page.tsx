'use client';

import { useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';

interface TrackResponse {
  number: string;
  status: string;
  shipping?: { courier?: string; trackingNumber?: string; scanEvents?: Array<{ status: string; location?: string; ts: string }> };
  statusHistory?: Array<{ from?: string; to?: string; ts: string; reason?: string }>;
  items: Array<{ sku: string; name: string; qty: number }>;
}

const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);
    try {
      const res = await apiFetch<TrackResponse>(
        `/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&identifier=${encodeURIComponent(identifier)}`,
      );
      setData(res);
    } catch {
      setError('No order matches those details.');
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold">Track your order</h1>
      <form onSubmit={lookup} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <NeuInput
          label="Order number"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="UNI-XXXX-XXXX"
        />
        <NeuInput
          label="Email or phone"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <div className="self-end">
          <NeuButton type="submit">Track</NeuButton>
        </div>
      </form>
      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

      {data ? (
        <NeuCard className="mt-8">
          <h2 className="font-display text-2xl font-semibold">{data.number}</h2>
          <p className="mt-1 text-sm uppercase tracking-wide text-text-muted">{data.status}</p>

          <ol className="mt-6 grid grid-cols-5 gap-1 text-center text-xs">
            {STEPS.map((step) => {
              const reached = STEPS.indexOf(step) <= STEPS.indexOf(data.status as (typeof STEPS)[number]);
              return (
                <li
                  key={step}
                  className={`rounded-md p-2 ${reached ? 'bg-brand-primary text-text-inverse' : 'shadow-neu-soft text-text-muted'}`}
                >
                  {step}
                </li>
              );
            })}
          </ol>

          {data.shipping?.trackingNumber ? (
            <p className="mt-4 text-sm">
              Courier — {data.shipping.courier?.toUpperCase()} · <span className="font-mono">{data.shipping.trackingNumber}</span>
            </p>
          ) : null}

          <h3 className="mt-6 text-sm font-semibold text-text-secondary">Scan timeline</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {(data.shipping?.scanEvents ?? []).length === 0 ? (
              <li className="text-text-muted">No scans yet.</li>
            ) : (
              data.shipping!.scanEvents!.map((e, i) => (
                <li key={i} className="rounded-md p-2 shadow-neu-soft">
                  <p className="text-xs text-text-muted">{new Date(e.ts).toLocaleString()}</p>
                  <p>
                    <span className="font-medium">{e.status}</span>
                    {e.location ? <span className="text-text-muted"> · {e.location}</span> : null}
                  </p>
                </li>
              ))
            )}
          </ul>
        </NeuCard>
      ) : null}
    </section>
  );
}
