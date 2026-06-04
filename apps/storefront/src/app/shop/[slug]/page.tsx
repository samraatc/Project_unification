import { notFound } from 'next/navigation';

import { NeuButton, NeuCard } from '@unified/design-system';

import { apiFetch, money } from '@/lib/api.js';

import { AddToCart } from '@/components/AddToCart.js';

interface ProductResponse {
  _id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  images?: { url: string; alt?: string }[];
  basePrice: number;
  salePrice?: number;
  currency?: string;
  rating?: { avg: number; count: number };
  variants?: Array<{ _id: string; sku: string; options: Record<string, unknown>; price: number; salePrice?: number }>;
  brand?: { name: string; slug: string };
  categories?: Array<{ _id: string; name: string; slug: string }>;
  reviews?: Array<{ _id: string; rating: number; title?: string; body?: string; createdAt: string }>;
}

interface PageProps {
  params: { slug: string };
}

export default async function PdpPage({ params }: PageProps) {
  let product: ProductResponse | null = null;
  try {
    product = await apiFetch<ProductResponse>(`/products/${params.slug}`, { cache: 'no-store' });
  } catch {
    return notFound();
  }
  if (!product) return notFound();

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr]">
        <NeuCard className="overflow-hidden p-0">
          {product.images?.[0]?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0].url}
              alt={product.images[0].alt ?? product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid aspect-square place-items-center bg-surface-sunken text-text-muted">No image</div>
          )}
        </NeuCard>

        <div>
          {product.brand?.name ? (
            <p className="text-xs uppercase tracking-wide text-text-muted">{product.brand.name}</p>
          ) : null}
          <h1 className="mt-2 font-display text-3xl font-semibold">{product.name}</h1>
          {product.rating?.count ? (
            <p className="mt-1 text-sm text-text-secondary">
              ★ {product.rating.avg.toFixed(1)} · {product.rating.count} reviews
            </p>
          ) : null}
          <p className="mt-4 font-display text-3xl">
            {money(product.salePrice ?? product.basePrice, product.currency)}
            {product.salePrice ? (
              <span className="ml-2 text-base text-text-muted line-through">
                {money(product.basePrice, product.currency)}
              </span>
            ) : null}
          </p>

          {product.description ? <p className="mt-4 text-sm leading-relaxed text-text-secondary">{product.description}</p> : null}

          <div className="mt-6">
            <AddToCart productId={product._id} variants={product.variants ?? []} />
          </div>

          {product.categories?.length ? (
            <p className="mt-6 text-xs text-text-muted">
              In {product.categories.map((c) => c.name).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      {product.reviews && product.reviews.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">Reviews</h2>
          <ul className="mt-6 space-y-4">
            {product.reviews.map((r) => (
              <li key={r._id}>
                <NeuCard dense>
                  <p className="text-sm">★ {r.rating}</p>
                  {r.title ? <h3 className="mt-1 font-semibold">{r.title}</h3> : null}
                  {r.body ? <p className="mt-1 text-sm text-text-secondary">{r.body}</p> : null}
                  <p className="mt-2 text-xs text-text-muted">{new Date(r.createdAt).toLocaleDateString()}</p>
                </NeuCard>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Hidden button to retain the design-system import even when no actions render. */}
      <span className="hidden">
        <NeuButton variant="ghost">.</NeuButton>
      </span>
    </section>
  );
}
