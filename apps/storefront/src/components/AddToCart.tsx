'use client';

import { useState } from 'react';

import { NeuButton } from '@unified/design-system';

import { apiFetch, ApiError } from '@/lib/api.js';

interface Variant {
  _id: string;
  sku: string;
  options: Record<string, unknown>;
  price: number;
  salePrice?: number;
}

export function AddToCart({ productId, variants }: { productId: string; variants: Variant[] }) {
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(variants[0]?._id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch('/cart/items', {
        method: 'POST',
        body: { productId, variantId, qty },
      });
      setMsg('Added to cart.');
    } catch (err) {
      const code = (err as ApiError).code ?? 'UNKNOWN';
      if (code === 'OUT_OF_STOCK') setMsg('Sorry, this is out of stock right now.');
      else setMsg('Could not add to cart. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {variants.length > 0 ? (
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="min-h-[44px] rounded-md bg-surface-sunken px-3 text-base shadow-neu-sunken focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          {variants.map((v) => (
            <option key={v._id} value={v._id}>
              {Object.entries(v.options).map(([k, val]) => `${k}: ${String(val)}`).join(' · ')}
            </option>
          ))}
        </select>
      ) : null}
      <div className="flex items-center gap-3">
        <label className="text-sm text-text-secondary" htmlFor="qty">
          Qty
        </label>
        <input
          id="qty"
          type="number"
          min={1}
          max={99}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          className="min-h-[44px] w-20 rounded-md bg-surface-sunken px-3 text-base shadow-neu-sunken focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>
      <NeuButton onClick={add} loading={busy} size="lg">
        Add to cart
      </NeuButton>
      {msg ? <p className="text-sm text-text-secondary">{msg}</p> : null}
    </div>
  );
}
