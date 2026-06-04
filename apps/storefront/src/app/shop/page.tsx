import { motion } from 'framer-motion';
import Link from 'next/link';

import { apiFetch, money } from '@/lib/api.js';

interface Product {
  _id: string;
  sku: string;
  name: string;
  slug: string;
  images?: { url: string; alt?: string; isPrimary?: boolean }[];
  basePrice: number;
  salePrice?: number;
  currency?: string;
  rating?: { avg: number; count: number };
}

interface PLPResponse {
  data: Product[];
  meta: { nextCursor: string | null };
}

interface PageProps {
  searchParams: { q?: string; sort?: string; category?: string };
}

export default async function ShopPage({ searchParams }: PageProps) {
  const params = new URLSearchParams();
  if (searchParams.q) params.set('q', searchParams.q);
  if (searchParams.sort) params.set('sort', searchParams.sort);
  if (searchParams.category) params.set('category', searchParams.category);

  // Run on the server for first-paint SEO + LCP win.
  let products: Product[] = [];
  try {
    const res = await apiFetch<PLPResponse>(
      `/products${params.toString() ? `?${params.toString()}` : ''}`,
      { cache: 'no-store' },
    );
    products = res.data;
  } catch {
    products = [];
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold">Shop</h1>
      <p className="mt-2 text-text-secondary">
        Browse the catalogue. Filter and sort to find exactly what you need.
      </p>

      <form className="mt-6 flex flex-wrap gap-3" action="/shop">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search…"
          className="min-h-[44px] flex-1 rounded-md bg-surface-sunken px-4 text-base shadow-neu-sunken focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <select
          name="sort"
          defaultValue={searchParams.sort ?? 'newest'}
          className="min-h-[44px] rounded-md bg-surface-raised px-3 shadow-neu-soft"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="popularity">Popular</option>
          <option value="rating">Top rated</option>
        </select>
        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-brand-primary px-6 text-text-inverse shadow-neu-soft"
        >
          Apply
        </button>
      </form>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.length === 0 ? (
          <p className="col-span-full text-text-secondary">No products yet.</p>
        ) : (
          products.map((p) => (
            <Link
              key={p._id}
              href={`/shop/${p.slug}`}
              className="block rounded-lg bg-surface-raised p-4 shadow-neu-soft hover:shadow-neu-raised"
            >
              <div className="aspect-square overflow-hidden rounded-md bg-surface-sunken">
                {p.images?.[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].url} alt={p.images[0].alt ?? p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-text-muted">No image</div>
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-medium">{p.name}</h3>
              <p className="mt-1 text-base font-semibold">
                {money(p.salePrice ?? p.basePrice, p.currency)}
                {p.salePrice ? (
                  <span className="ml-2 text-xs text-text-muted line-through">
                    {money(p.basePrice, p.currency)}
                  </span>
                ) : null}
              </p>
              {p.rating?.count ? (
                <p className="mt-1 text-xs text-text-muted">
                  ★ {p.rating.avg.toFixed(1)} ({p.rating.count})
                </p>
              ) : null}
            </Link>
          ))
        )}
      </div>

      <noscript>
        <p className="mt-6 text-sm text-text-secondary">
          JavaScript is disabled — links still work, but filtering refreshes the page.
        </p>
      </noscript>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
    </section>
  );
}
