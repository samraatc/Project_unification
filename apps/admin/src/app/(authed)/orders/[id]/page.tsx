'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface OrderDetail {
  _id: string;
  number: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'returned' | 'refunded' | 'cancelled';
  items: Array<{ _id: string; sku: string; name: string; qty: number; unitPrice: number; subtotal: number }>;
  totals: { subtotal: number; discount: number; deliveryFee: number; tax: number; total: number };
  currency: string;
  payment?: { method?: string; status?: string };
  shipping?: { courier?: string; trackingNumber?: string; scanEvents?: Array<{ status: string; location?: string; ts: string }> };
  statusHistory?: Array<{ from?: string; to?: string; ts: string; reason?: string }>;
}

const NEXT_STATUS: Record<string, OrderDetail['status'][]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  returned: [],
  refunded: [],
  cancelled: [],
};

function money(n: number, c = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n / 100);
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${params.id}`, { accessToken }),
    enabled: Boolean(accessToken),
  });

  const transition = useMutation({
    mutationFn: async (input: { to: OrderDetail['status']; courierCode?: 'pathao' | 'aramex'; trackingNumber?: string }) =>
      apiFetch(`/orders/${query.data?._id}/transitions`, { method: 'POST', accessToken, body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', params.id] }),
  });

  const refund = useMutation({
    mutationFn: async (amount: number) =>
      apiFetch(`/orders/${query.data?._id}/refunds`, { method: 'POST', accessToken, body: { amount } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', params.id] }),
  });

  const [courierCode, setCourierCode] = useState<'pathao' | 'aramex'>('pathao');
  const [trackingNumber, setTrackingNumber] = useState('');

  if (query.isLoading) return <div className="skeleton h-64" aria-busy role="status" />;
  if (!query.data) return <p>Order not found.</p>;

  const order = query.data;
  const allowed = NEXT_STATUS[order.status] ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <NeuCard>
        <h1 className="font-display text-2xl font-semibold">Order {order.number}</h1>
        <p className="mt-1 text-sm uppercase tracking-wide text-text-muted">{order.status}</p>
        <ul className="mt-6 divide-y divide-surface-sunken/40">
          {order.items.map((it) => (
            <li key={it._id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{it.name}</p>
                <p className="text-text-muted">{it.sku} · {it.qty} × {money(it.unitPrice, order.currency)}</p>
              </div>
              <p className="font-medium">{money(it.subtotal, order.currency)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 text-sm">
          <Row label="Subtotal" value={money(order.totals.subtotal, order.currency)} />
          <Row label="Discount" value={`− ${money(order.totals.discount, order.currency)}`} />
          <Row label="Delivery" value={money(order.totals.deliveryFee, order.currency)} />
          <Row label="Tax" value={money(order.totals.tax, order.currency)} />
          <hr className="my-2 border-surface-sunken/40" />
          <Row label="Total" value={money(order.totals.total, order.currency)} bold />
        </dl>
        <p className="mt-3 text-xs text-text-muted">
          Payment — {order.payment?.method?.toUpperCase()} · {order.payment?.status}
        </p>
      </NeuCard>

      <div className="space-y-4">
        <NeuCard>
          <h2 className="text-lg font-semibold">Transitions</h2>
          <p className="mt-1 text-xs text-text-muted">Only edges allowed by the state machine are shown.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {allowed.length === 0 ? (
              <p className="text-sm text-text-secondary">No transitions available.</p>
            ) : (
              allowed.map((to) => (
                <NeuButton
                  key={to}
                  variant={to === 'cancelled' ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => transition.mutate({ to })}
                  loading={transition.isPending && transition.variables?.to === to}
                >
                  {to}
                </NeuButton>
              ))
            )}
          </div>
        </NeuCard>

        {(order.status === 'processing' || order.status === 'confirmed') && (
          <NeuCard>
            <h2 className="text-lg font-semibold">Ship</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="block text-text-secondary">Courier</span>
                <select
                  value={courierCode}
                  onChange={(e) => setCourierCode(e.target.value as 'pathao' | 'aramex')}
                  className="mt-1 w-full rounded-md bg-surface-sunken px-3 py-2 text-base shadow-neu-sunken"
                >
                  <option value="pathao">Pathao</option>
                  <option value="aramex">Aramex</option>
                </select>
              </label>
              <NeuInput
                label="Tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
              <NeuButton
                onClick={() => transition.mutate({ to: 'shipped', courierCode, trackingNumber })}
                disabled={!trackingNumber}
              >
                Mark shipped
              </NeuButton>
            </div>
          </NeuCard>
        )}

        {order.payment?.status === 'paid' && (
          <NeuCard>
            <h2 className="text-lg font-semibold">Refund</h2>
            <p className="mt-1 text-sm text-text-secondary">Issue a full refund through the original gateway.</p>
            <div className="mt-3">
              <NeuButton
                variant="danger"
                onClick={() => refund.mutate(order.totals.total)}
                loading={refund.isPending}
              >
                Refund {money(order.totals.total, order.currency)}
              </NeuButton>
            </div>
          </NeuCard>
        )}

        <NeuCard>
          <h2 className="text-lg font-semibold">Tracking</h2>
          {order.shipping?.trackingNumber ? (
            <p className="mt-1 text-sm">
              {order.shipping.courier?.toUpperCase()} — <span className="font-mono">{order.shipping.trackingNumber}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">No courier assigned yet.</p>
          )}
          <ul className="mt-4 space-y-2">
            {(order.shipping?.scanEvents ?? []).map((e, i) => (
              <li key={i} className="text-xs">
                <span className="text-text-muted">{new Date(e.ts).toLocaleString()}</span>{' '}
                <span className="font-medium">{e.status}</span>
                {e.location ? <span className="text-text-muted"> · {e.location}</span> : null}
              </li>
            ))}
          </ul>
        </NeuCard>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
