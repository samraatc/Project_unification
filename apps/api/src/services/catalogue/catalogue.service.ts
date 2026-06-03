import { Types } from 'mongoose';

import {
  Brand,
  Category,
  Inventory,
  Product,
  type ProductDoc,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';

/**
 * Catalogue domain service.
 *
 * Handles: product CRUD with slugify, variant management, category tree, brand
 * registry. Bulk CSV import is delegated to `bulkImport.service` so the API
 * route can return a job id immediately (BullMQ).
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/* -------------------------------------------------------------------------- */
/* Brands                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateBrandInput {
  tenantId: string;
  actorId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  ip?: string;
  ua?: string;
}

export async function createBrand(input: CreateBrandInput) {
  const slug = slugify(input.name);
  const brand = await Brand.create({
    tenantId: input.tenantId,
    name: input.name,
    slug,
    description: input.description,
    logoUrl: input.logoUrl,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'brand.created',
    entity: 'Brand',
    entityId: brand._id,
    afterJson: { name: input.name, slug },
    ip: input.ip,
    ua: input.ua,
  });
  return brand;
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export interface CreateCategoryInput {
  tenantId: string;
  actorId: string;
  name: string;
  parentId?: string;
  imageUrl?: string;
  order?: number;
  ip?: string;
  ua?: string;
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = slugify(input.name);
  let path: Types.ObjectId[] = [];
  let depth = 0;
  if (input.parentId) {
    const parent = await Category.findOne({ _id: input.parentId, tenantId: input.tenantId }).select('path depth').lean();
    if (!parent) throw new HttpError(404, 'PARENT_NOT_FOUND', 'Parent category not found.');
    path = [...(parent.path ?? []), parent._id as unknown as Types.ObjectId];
    depth = (parent.depth ?? 0) + 1;
  }
  const cat = await Category.create({
    tenantId: input.tenantId,
    name: input.name,
    slug,
    parent: input.parentId ?? null,
    path,
    depth,
    imageUrl: input.imageUrl,
    order: input.order ?? 0,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'category.created',
    entity: 'Category',
    entityId: cat._id,
    afterJson: { name: input.name, parentId: input.parentId ?? null, depth },
    ip: input.ip,
    ua: input.ua,
  });
  return cat;
}

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  depth: number;
  order: number;
  children: CategoryNode[];
}

export async function getCategoryTree(tenantId: string): Promise<CategoryNode[]> {
  const cats = await Category.find({ tenantId, status: 'active' })
    .sort({ depth: 1, order: 1, name: 1 })
    .lean();
  const byId = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];
  for (const c of cats) {
    byId.set(String(c._id), { id: String(c._id), name: c.name, slug: c.slug, depth: c.depth ?? 0, order: c.order ?? 0, children: [] });
  }
  for (const c of cats) {
    const node = byId.get(String(c._id))!;
    if (c.parent) byId.get(String(c.parent))?.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateProductInput {
  tenantId: string;
  actorId: string;
  sku: string;
  name: string;
  description?: string;
  brandId?: string;
  categoryIds?: string[];
  images?: { url: string; alt?: string; isPrimary?: boolean; order?: number }[];
  basePrice: number;
  salePrice?: number;
  currency?: string;
  taxClass?: 'standard' | 'reduced' | 'zero' | 'exempt';
  attributes?: Record<string, unknown>;
  variants?: Array<{
    sku: string;
    options: Record<string, unknown>;
    price: number;
    salePrice?: number;
    barcode?: string;
  }>;
  status?: 'draft' | 'active' | 'archived';
  initialStock?: number;
  ip?: string;
  ua?: string;
}

export async function createProduct(input: CreateProductInput): Promise<ProductDoc> {
  const slug = slugify(input.name);
  const existing = await Product.findOne({ tenantId: input.tenantId, $or: [{ sku: input.sku }, { slug }] }).select('_id');
  if (existing) throw new HttpError(409, 'PRODUCT_EXISTS', 'A product with that SKU or slug already exists.');

  const product = await Product.create({
    tenantId: input.tenantId,
    sku: input.sku,
    name: input.name,
    slug,
    description: input.description,
    brand: input.brandId,
    categories: input.categoryIds,
    images: input.images ?? [],
    basePrice: input.basePrice,
    salePrice: input.salePrice,
    currency: input.currency ?? 'USD',
    taxClass: input.taxClass ?? 'standard',
    attributes: input.attributes ?? {},
    variants: input.variants ?? [],
    status: input.status ?? 'draft',
  });

  // Seed inventory rows for the base SKU + each variant.
  const skus = [input.sku, ...(input.variants?.map((v) => v.sku) ?? [])];
  for (const sku of skus) {
    // eslint-disable-next-line no-await-in-loop
    await Inventory.updateOne(
      { tenantId: input.tenantId, sku },
      {
        $setOnInsert: {
          productId: product._id,
          onHand: input.initialStock ?? 0,
          reserved: 0,
          available: input.initialStock ?? 0,
        },
      },
      { upsert: true },
    );
  }

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'product.created',
    entity: 'Product',
    entityId: product._id,
    afterJson: { sku: input.sku, slug, status: product.status },
    ip: input.ip,
    ua: input.ua,
  });
  return product;
}

export interface UpdateProductInput {
  productId: string;
  tenantId: string;
  actorId: string;
  changes: Partial<{
    name: string;
    description: string;
    descriptionRich: string;
    brandId: string | null;
    categoryIds: string[];
    images: { url: string; alt?: string; isPrimary?: boolean; order?: number }[];
    basePrice: number;
    salePrice: number;
    currency: string;
    taxClass: 'standard' | 'reduced' | 'zero' | 'exempt';
    attributes: Record<string, unknown>;
    variants: Array<{ sku: string; options: Record<string, unknown>; price: number; salePrice?: number; barcode?: string }>;
    status: 'draft' | 'active' | 'archived';
  }>;
  ip?: string;
  ua?: string;
}

export async function updateProduct(input: UpdateProductInput): Promise<ProductDoc> {
  const product = await Product.findOne({ _id: input.productId, tenantId: input.tenantId });
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const before = product.toObject();
  const c = input.changes;

  if (c.name && c.name !== product.name) {
    product.name = c.name;
    product.slug = slugify(c.name);
  }
  if (c.description !== undefined) product.description = c.description;
  if (c.descriptionRich !== undefined) product.descriptionRich = c.descriptionRich;
  if (c.brandId !== undefined) product.brand = (c.brandId ?? undefined) as unknown as ProductDoc['brand'];
  if (c.categoryIds) product.categories = c.categoryIds as unknown as ProductDoc['categories'];
  if (c.images) product.images = c.images;
  if (c.basePrice !== undefined) product.basePrice = c.basePrice;
  if (c.salePrice !== undefined) product.salePrice = c.salePrice;
  if (c.currency) product.currency = c.currency;
  if (c.taxClass) product.taxClass = c.taxClass;
  if (c.attributes) product.attributes = c.attributes;
  if (c.variants) product.variants = c.variants as unknown as ProductDoc['variants'];
  if (c.status) product.status = c.status;

  await product.save();

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'product.updated',
    entity: 'Product',
    entityId: product._id,
    beforeJson: { name: before.name, status: before.status, basePrice: before.basePrice },
    afterJson: { name: product.name, status: product.status, basePrice: product.basePrice },
    ip: input.ip,
    ua: input.ua,
  });
  return product;
}

export async function archiveProduct(input: { productId: string; tenantId: string; actorId: string; ip?: string; ua?: string }) {
  const product = await Product.findOne({ _id: input.productId, tenantId: input.tenantId });
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  product.status = 'archived';
  await product.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'product.archived',
    entity: 'Product',
    entityId: product._id,
    ip: input.ip,
    ua: input.ua,
  });
}
