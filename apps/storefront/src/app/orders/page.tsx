'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { NeuCard } from '@unified/design-system';

import { apiFetch, money } from '@/lib/api.js';

interface OrderRow {
  _id: string;
  number: string;
  status: string;
  totals: { total: number };
  currency: string;
  createdAt: string;
}

export default function MyOrdersPage() {
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: OrderRow[] }>('/orders/me')
      .then((res) => setRows(res.data))
      .catch(() => setError('Sign in to see your orders.'));
  }, []);

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold">My orders</h1>
      {error ? <p className="mt-4 text-text-secondary">{error}</p> : null}
      {!rows ? (
        <div className="skeleton mt-6 h-32" aria-busy role="status" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-text-secondary">No orders yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r._id}>
              <Link href={`/orders/${r.number}`} className="block">
                <NeuCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{r.number}</p>
                      <p className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{money(r.totals.total, r.currency)}</p>
                      <p className="text-xs capitalize text-text-muted">{r.status}</p>
                    </div>
                  </div>
                </NeuCard>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
