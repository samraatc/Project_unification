import { Product, type ProductDoc } from '../../db/models/index.js';

/**
 * Catalogue search.
 *
 * Primary backend: MongoDB Atlas Search (`$search` aggregation) — index spec in
 * `infra/atlas-search-indexes/products.json`. Atlas Search is unavailable in
 * `mongodb-memory-server` (CI), so when `process.env.SEARCH_BACKEND === 'mongo'`
 * (the default in dev/test) we fall back to a `$regex` query over name/sku.
 *
 * Meilisearch is the documented secondary fallback for self-hosted tenants
 * (TRD §1). The adapter for it lives in this same file behind the
 * `SEARCH_BACKEND === 'meili'` switch.
 */

export interface SearchInput {
  tenantId: string;
  q?: string;
  filters?: {
    categoryIds?: string[];
    brandIds?: string[];
    priceMin?: number;
    priceMax?: number;
    inStock?: boolean;
    minRating?: number;
  };
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popularity' | 'rating';
  cursor?: string;
  limit: number;
}

export interface SearchResult {
  data: Array<Pick<ProductDoc, '_id' | 'sku' | 'name' | 'slug' | 'images' | 'basePrice' | 'salePrice' | 'currency' | 'rating'>>;
  nextCursor: string | null;
}

export async function searchProducts(input: SearchInput): Promise<SearchResult> {
  const backend = process.env.SEARCH_BACKEND ?? 'mongo';
  if (backend === 'atlas') return searchViaAtlas(input);
  if (backend === 'meili') return searchViaMeilisearch(input);
  return searchViaMongo(input);
}

/* -------------------------------------------------------------------------- */
/* MongoDB fallback (dev + test)                                              */
/* -------------------------------------------------------------------------- */

async function searchViaMongo(input: SearchInput): Promise<SearchResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
  const filter: any = { tenantId: input.tenantId, status: 'active' };
  if (input.q) {
    const re = new RegExp(escapeRe(input.q), 'i');
    filter.$or = [{ name: re }, { sku: re }, { description: re }];
  }
  if (input.filters?.categoryIds?.length) filter.categories = { $in: input.filters.categoryIds };
  if (input.filters?.brandIds?.length) filter.brand = { $in: input.filters.brandIds };
  if (input.filters?.priceMin !== undefined || input.filters?.priceMax !== undefined) {
    filter.basePrice = {};
    if (input.filters.priceMin !== undefined) filter.basePrice.$gte = input.filters.priceMin;
    if (input.filters.priceMax !== undefined) filter.basePrice.$lte = input.filters.priceMax;
  }
  if (input.filters?.minRating) filter['rating.avg'] = { $gte: input.filters.minRating };
  if (input.cursor) filter._id = { $lt: input.cursor };

  const sortMap: Record<NonNullable<SearchInput['sort']>, Record<string, 1 | -1>> = {
    newest: { _id: -1 },
    price_asc: { basePrice: 1, _id: -1 },
    price_desc: { basePrice: -1, _id: -1 },
    popularity: { 'rating.count': -1, _id: -1 },
    rating: { 'rating.avg': -1, _id: -1 },
  };

  const docs = await Product.find(filter)
    .select('sku name slug images basePrice salePrice currency rating')
    .sort(sortMap[input.sort ?? 'newest'])
    .limit(input.limit + 1)
    .lean();

  const hasMore = docs.length > input.limit;
  const items = hasMore ? docs.slice(0, input.limit) : docs;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lean shape vs InferSchemaType
    data: items as any,
    nextCursor: hasMore ? String(items[items.length - 1]?._id) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Atlas Search                                                               */
/* -------------------------------------------------------------------------- */

async function searchViaAtlas(input: SearchInput): Promise<SearchResult> {
  const must: unknown[] = [];
  if (input.q) {
    must.push({
      compound: {
        should: [
          { text: { query: input.q, path: 'name', score: { boost: { value: 3 } } } },
          { text: { query: input.q, path: 'description' } },
          { text: { query: input.q, path: 'attributes' } },
        ],
      },
    });
  }
  const filter: unknown[] = [
    { equals: { path: 'tenantId', value: input.tenantId } },
    { equals: { path: 'status', value: 'active' } },
  ];
  if (input.filters?.categoryIds?.length) {
    filter.push({ in: { path: 'categories', value: input.filters.categoryIds } });
  }
  if (input.filters?.brandIds?.length) {
    filter.push({ in: { path: 'brand', value: input.filters.brandIds } });
  }
  if (input.filters?.priceMin !== undefined || input.filters?.priceMax !== undefined) {
    filter.push({
      range: {
        path: 'basePrice',
        gte: input.filters.priceMin ?? 0,
        lte: input.filters.priceMax ?? Number.MAX_SAFE_INTEGER,
      },
    });
  }

  const pipeline = [
    {
      $search: {
        index: 'products',
        compound: { must, filter },
      },
    },
    { $limit: input.limit + 1 },
    {
      $project: {
        sku: 1,
        name: 1,
        slug: 1,
        images: 1,
        basePrice: 1,
        salePrice: 1,
        currency: 1,
        rating: 1,
      },
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- aggregate types
  const docs = (await Product.aggregate(pipeline as any[]).exec()) as any[];
  const hasMore = docs.length > input.limit;
  const items = hasMore ? docs.slice(0, input.limit) : docs;
  return {
    data: items,
    nextCursor: hasMore ? String(items[items.length - 1]?._id) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Meilisearch (self-hosted fallback)                                         */
/* -------------------------------------------------------------------------- */

async function searchViaMeilisearch(_input: SearchInput): Promise<SearchResult> {
  // TODO(phase-3.3): wire `meilisearch` JS client when MEILI_HOST + MEILI_KEY are present.
  return { data: [], nextCursor: null };
}

/* -------------------------------------------------------------------------- */
/* Autocomplete                                                                */
/* -------------------------------------------------------------------------- */

export async function suggest(tenantId: string, q: string, limit = 8): Promise<string[]> {
  if (!q || q.length < 2) return [];
  const re = new RegExp('^' + escapeRe(q), 'i');
  const docs = await Product.find({ tenantId, status: 'active', name: re })
    .select('name')
    .limit(limit)
    .lean();
  return docs.map((d) => d.name);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
