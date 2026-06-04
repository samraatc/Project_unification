'use client';

import { useEffect, useState } from 'react';

import { NeuCard } from '@unified/design-system';

import { apiFetch, money } from '@/lib/api.js';

interface OrderResponse {
  number: string;
  status: string;
  items: Array<{ sku: string; name: string; qty: number; unitPrice: number; subtotal: number }>;
  totals: { subtotal: number; discount: number; deliveryFee: number; tax: number; total: number };
  currency: string;
  payment: { method?: string; status?: string };
  shipping?: { method?: string; address?: unknown };
  createdAt?: string;
}

export default function OrderDetailPage({ params }: { params: { number: string } }) {
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<OrderResponse>(`/orders/${params.number}`)
      .then(setOrder)
      .catch(() => setError('Could not load order.'));
  }, [params.number]);

  if (error) return <p className="mx-auto max-w-3xl px-6 py-16 text-error">{error}</p>;
  if (!order) return <div className="skeleton mx-auto mt-16 h-64 max-w-3xl" aria-busy role="status" />;

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold">Order {order.number}</h1>
      <p className="mt-2 text-text-secondary capitalize">Status — {order.status}</p>

      <NeuCard className="mt-6">
        <ul className="divide-y divide-surface-sunken/40">
          {order.items.map((it, i) => (
            <li key={i} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{it.name}</p>
                <p className="text-text-muted">
                  {it.sku} · {it.qty} × {money(it.unitPrice, order.currency)}
                </p>
              </div>
              <p className="font-medium">{money(it.subtotal, order.currency)}</p>
            </li>
          ))}
        </ul>
      </NeuCard>

      <NeuCard className="mt-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.totals.subtotal, order.currency)}</dd></div>
          <div className="flex justify-between"><dt>Discount</dt><dd>− {money(order.totals.discount, order.currency)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{money(order.totals.deliveryFee, order.currency)}</dd></div>
          <div className="flex justify-between"><dt>Tax</dt><dd>{money(order.totals.tax, order.currency)}</dd></div>
          <hr className="my-2 border-surface-sunken" />
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{money(order.totals.total, order.currency)}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-text-muted">
          Payment — {order.payment?.method?.toUpperCase()} · {order.payment?.status}
        </p>
      </NeuCard>
    </section>
  );
}
