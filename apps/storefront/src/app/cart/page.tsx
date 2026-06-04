'use client';

import { useEffect, useState } from 'react';

import { NeuButton, NeuCard } from '@unified/design-system';
import Link from 'next/link';

import { apiFetch, money } from '@/lib/api.js';

interface CartItem {
  _id: string;
  productId: string;
  sku: string;
  qty: number;
  unitPrice: number;
  snapshotName?: string;
  snapshotImage?: string;
}

interface CartResponse {
  _id: string;
  items: CartItem[];
  totals: { subtotal: number; discount: number; deliveryFee: number; tax: number; total: number };
  currency: string;
  coupon?: { code: string; value: number };
}

export default function CartPage() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const data = await apiFetch<CartResponse>('/cart');
    setCart(data);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function update(itemId: string, qty: number) {
    await apiFetch(`/cart/items/${itemId}`, { method: 'PATCH', body: { qty } });
    await refresh();
  }
  async function remove(itemId: string) {
    await apiFetch(`/cart/items/${itemId}`, { method: 'DELETE' });
    await refresh();
  }
  async function applyCoupon() {
    setMsg(null);
    try {
      await apiFetch('/cart/coupon', { method: 'POST', body: { code } });
      await refresh();
      setMsg('Coupon applied.');
    } catch {
      setMsg('Coupon could not be applied.');
    }
  }
  async function removeCoupon() {
    await apiFetch('/cart/coupon', { method: 'DELETE' });
    await refresh();
  }

  if (!cart) return <div className="skeleton mx-auto mt-16 h-64 max-w-4xl" aria-busy role="status" />;

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold">Your cart</h1>
      {cart.items.length === 0 ? (
        <NeuCard className="mt-6">
          <p className="text-text-secondary">Your cart is empty.</p>
          <div className="mt-3">
            <Link href="/shop" className="underline">
              Continue shopping
            </Link>
          </div>
        </NeuCard>
      ) : (
        <div className="mt-6 space-y-6">
          <ul className="space-y-3">
            {cart.items.map((it) => (
              <li key={it._id}>
                <NeuCard>
                  <div className="flex items-center gap-4">
                    {it.snapshotImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.snapshotImage} alt="" className="h-20 w-20 rounded-md object-cover" />
                    ) : (
                      <div className="h-20 w-20 rounded-md bg-surface-sunken" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{it.snapshotName ?? it.sku}</p>
                      <p className="text-sm text-text-muted">{money(it.unitPrice, cart.currency)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => update(it._id, it.qty - 1)}
                        className="grid h-10 w-10 place-items-center rounded-md shadow-neu-soft active:shadow-neu-sunken"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{it.qty}</span>
                      <button
                        onClick={() => update(it._id, it.qty + 1)}
                        className="grid h-10 w-10 place-items-center rounded-md shadow-neu-soft active:shadow-neu-sunken"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-24 text-right font-medium">{money(it.unitPrice * it.qty, cart.currency)}</div>
                    <button onClick={() => remove(it._id)} className="text-sm text-error">
                      Remove
                    </button>
                  </div>
                </NeuCard>
              </li>
            ))}
          </ul>

          <NeuCard>
            <h2 className="text-lg font-semibold">Coupon</h2>
            {cart.coupon ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full bg-success/10 px-3 py-1 text-sm text-success">
                  {cart.coupon.code} — {money(cart.coupon.value, cart.currency)} off
                </span>
                <button onClick={removeCoupon} className="text-sm text-error">
                  Remove
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CODE"
                  className="min-h-[44px] flex-1 rounded-md bg-surface-sunken px-4 text-base shadow-neu-sunken focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <NeuButton onClick={applyCoupon}>Apply</NeuButton>
              </div>
            )}
            {msg ? <p className="mt-2 text-sm text-text-secondary">{msg}</p> : null}
          </NeuCard>

          <NeuCard>
            <dl className="space-y-1 text-sm">
              <Row label="Subtotal" value={money(cart.totals.subtotal, cart.currency)} />
              <Row label="Discount" value={`− ${money(cart.totals.discount, cart.currency)}`} />
              <Row label="Delivery" value={money(cart.totals.deliveryFee, cart.currency)} />
              <Row label="Tax" value={money(cart.totals.tax, cart.currency)} />
            </dl>
            <hr className="my-3 border-surface-sunken" />
            <p className="flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{money(cart.totals.total, cart.currency)}</span>
            </p>
            <div className="mt-4">
              <Link
                href="/checkout"
                className="block w-full rounded-md bg-brand-primary py-3 text-center text-text-inverse shadow-neu-soft"
              >
                Checkout
              </Link>
            </div>
          </NeuCard>
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-secondary">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
