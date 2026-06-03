import { Router } from 'express';
import { z } from 'zod';

import { Brand, Category, Product, Review } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  archiveProduct,
  createBrand,
  createCategory,
  createProduct,
  getCategoryTree,
  updateProduct,
} from '../../services/catalogue/catalogue.service.js';
import { enqueueBulkImport, getImportProgress } from '../../services/catalogue/bulkImport.service.js';
import { searchProducts, suggest } from '../../services/catalogue/search.service.js';

export const productsRouter: Router = Router();
export const categoriesRouter: Router = Router();
export const brandsRouter: Router = Router();
export const searchRouter: Router = Router();

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

const SearchQuery = z.object({
  q: z.string().max(200).optional(),
  category: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : undefined)),
  brand: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : undefined)),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  inStock: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popularity', 'rating']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

searchRouter.get('/', validate(SearchQuery, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof SearchQuery>;
    const tenantId = req.user?.tenantId ?? '000000000000000000000001';
    const result = await searchProducts({
      tenantId,
      q: q.q,
      filters: {
        categoryIds: q.category,
        brandIds: q.brand,
        priceMin: q.priceMin,
        priceMax: q.priceMax,
        inStock: q.inStock,
        minRating: q.minRating,
      },
      sort: q.sort,
      cursor: q.cursor,
      limit: q.limit,
    });
    res.json({ data: result.data, meta: { nextCursor: result.nextCursor } });
  } catch (err) {
    next(err);
  }
});

searchRouter.get('/suggest', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '');
    const tenantId = req.user?.tenantId ?? '000000000000000000000001';
    const suggestions = await suggest(tenantId, q);
    res.json({ data: suggestions });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

productsRouter.get('/', validate(SearchQuery, 'query'), async (req, res, next) => {
  try {
    // PLP fall-through: same shape as /search.
    const q = req.query as unknown as z.infer<typeof SearchQuery>;
    const tenantId = req.user?.tenantId ?? '000000000000000000000001';
    const result = await searchProducts({
      tenantId,
      q: q.q,
      filters: {
        categoryIds: q.category,
        brandIds: q.brand,
        priceMin: q.priceMin,
        priceMax: q.priceMax,
      },
      sort: q.sort,
      cursor: q.cursor,
      limit: q.limit,
    });
    res.json({ data: result.data, meta: { nextCursor: result.nextCursor } });
  } catch (err) {
    next(err);
  }
});

productsRouter.get('/:slug', async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId ?? '000000000000000000000001';
    const product = await Product.findOne({ tenantId, slug: req.params.slug, status: 'active' }).lean();
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    const [brand, categories, reviews] = await Promise.all([
      product.brand ? Brand.findById(product.brand).select('name slug logoUrl').lean() : null,
      product.categories?.length
        ? Category.find({ _id: { $in: product.categories } }).select('name slug').lean()
        : [],
      Review.find({ productId: product._id, status: 'published' })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('rating title body helpfulVotes createdAt userId')
        .lean(),
    ]);
    res.json({ ...product, brand, categories, reviews });
  } catch (err) {
    next(err);
  }
});

const CreateProductBody = z.object({
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  description: z.string().max(20_000).optional(),
  brandId: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string().max(300).optional(),
        isPrimary: z.boolean().optional(),
        order: z.number().int().optional(),
      }),
    )
    .default([]),
  basePrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('USD'),
  taxClass: z.enum(['standard', 'reduced', 'zero', 'exempt']).default('standard'),
  attributes: z.record(z.unknown()).optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1),
        options: z.record(z.unknown()),
        price: z.number().nonnegative(),
        salePrice: z.number().nonnegative().optional(),
        barcode: z.string().optional(),
      }),
    )
    .default([]),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  initialStock: z.number().int().nonnegative().optional(),
});

productsRouter.post(
  '/',
  requireAuth,
  requirePermission('products.create'),
  validate(CreateProductBody),
  async (req, res, next) => {
    try {
      const product = await createProduct({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...req.body,
      });
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  },
);

const UpdateProductBody = CreateProductBody.partial().strict();

productsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('products.update'),
  validate(UpdateProductBody),
  async (req, res, next) => {
    try {
      const product = await updateProduct({
        productId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        changes: req.body,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('products.delete'),
  async (req, res, next) => {
    try {
      await archiveProduct({
        productId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

const ImportBody = z.object({ s3Key: z.string().min(1), filename: z.string().min(1) });

productsRouter.post(
  '/import',
  requireAuth,
  requirePermission('products.create'),
  validate(ImportBody),
  async (req, res, next) => {
    try {
      const result = await enqueueBulkImport({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        s3Key: req.body.s3Key,
        filename: req.body.filename,
      });
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  },
);

const importsRouter: Router = Router();
importsRouter.get(
  '/:jobId',
  requireAuth,
  requirePermission('products.create'),
  async (req, res, next) => {
    try {
      const progress = await getImportProgress(req.params.jobId);
      res.json(progress);
    } catch (err) {
      next(err);
    }
  },
);
export { importsRouter };

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

categoriesRouter.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId ?? '000000000000000000000001';
    const tree = await getCategoryTree(tenantId);
    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
});

const CreateCategoryBody = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  order: z.number().int().optional(),
});

categoriesRouter.post(
  '/',
  requireAuth,
  requirePermission('catalogue.update'),
  validate(CreateCategoryBody),
  async (req, res, next) => {
    try {
      const cat = await createCategory({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...req.body,
      });
      res.status(201).json(cat);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Brands                                                                     */
/* -------------------------------------------------------------------------- */

brandsRouter.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId ?? '000000000000000000000001';
    const items = await Brand.find({ tenantId, status: 'active' }).sort({ name: 1 }).lean();
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
});

const CreateBrandBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
});

brandsRouter.post(
  '/',
  requireAuth,
  requirePermission('catalogue.update'),
  validate(CreateBrandBody),
  async (req, res, next) => {
    try {
      const brand = await createBrand({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
        ...req.body,
      });
      res.status(201).json(brand);
    } catch (err) {
      next(err);
    }
  },
);
