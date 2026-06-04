import { Types } from 'mongoose';

import {
  CommunicationLog,
  Inventory,
  InboxMessage,
  Order,
  Post,
  Product,
  Review,
  User,
} from '../../db/models/index.js';
import { cached } from './cache.js';

/**
 * Read-only analytics aggregations.
 *
 * Every endpoint goes through `cached()` so dashboards survive bursty refreshes
 * (each unique query is computed at most once per 5 minutes per tenant).
 * All aggregation pipelines are tenant-scoped at the `$match` stage — the
 * service never reads cross-tenant data even if the input is missing.
 */

function tenantOid(tenantId: string): Types.ObjectId | string {
  try {
    return new Types.ObjectId(tenantId);
  } catch {
    return tenantId;
  }
}

interface DateRange {
  from: Date;
  to: Date;
}

function defaultRange(): DateRange {
  return {
    from: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    to: new Date(),
  };
}

/* -------------------------------------------------------------------------- */
/* Overview — single home page KPI tiles                                       */
/* -------------------------------------------------------------------------- */

export interface OverviewKpis {
  range: { from: string; to: string };
  sales: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    paidOrders: number;
  };
  inventory: {
    lowStockSkus: number;
    outOfStockSkus: number;
  };
  customers: {
    newCustomers: number;
    repeatCustomers: number;
  };
  social: {
    postsPublished: number;
    inboxOpen: number;
    slaBreached: number;
  };
}

export async function getOverview(tenantId: string, range: DateRange = defaultRange()): Promise<OverviewKpis> {
  return cached('overview', tenantId, range, async () => {
    const oid = tenantOid(tenantId);
    const [sales, inv, custs, posts, inboxStats] = await Promise.all([
      Order.aggregate([
        { $match: { tenantId: oid, createdAt: { $gte: range.from, $lte: range.to } } },
        {
          $group: {
            _id: null,
            revenue: {
              $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$totals.total', 0] },
            },
            orders: { $sum: 1 },
            paidOrders: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, 1, 0] } },
          },
        },
      ]),
      Inventory.aggregate([
        { $match: { tenantId: oid } },
        {
          $group: {
            _id: null,
            lowStockSkus: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$threshold', 0] }, { $lte: ['$available', '$threshold'] }] },
                  1,
                  0,
                ],
              },
            },
            outOfStockSkus: {
              $sum: { $cond: [{ $lte: ['$available', 0] }, 1, 0] },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { tenantId: oid, userId: { $ne: null } } },
        { $group: { _id: '$userId', count: { $sum: 1 }, firstAt: { $min: '$createdAt' } } },
        {
          $group: {
            _id: null,
            newCustomers: {
              $sum: { $cond: [{ $gte: ['$firstAt', range.from] }, 1, 0] },
            },
            repeatCustomers: { $sum: { $cond: [{ $gt: ['$count', 1] }, 1, 0] } },
          },
        },
      ]),
      Post.countDocuments({
        tenantId: oid,
        status: 'published',
        publishedAt: { $gte: range.from, $lte: range.to },
      }),
      Promise.all([
        InboxMessage.countDocuments({ tenantId: oid, status: { $in: ['new', 'open'] } }),
        InboxMessage.countDocuments({
          tenantId: oid,
          slaBreachedAt: { $gte: range.from, $lte: range.to },
        }),
      ]),
    ]);

    const s = sales[0] ?? { revenue: 0, orders: 0, paidOrders: 0 };
    const i = inv[0] ?? { lowStockSkus: 0, outOfStockSkus: 0 };
    const c = custs[0] ?? { newCustomers: 0, repeatCustomers: 0 };
    const [inboxOpen, slaBreached] = inboxStats;

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      sales: {
        revenue: s.revenue,
        orders: s.orders,
        paidOrders: s.paidOrders,
        avgOrderValue: s.paidOrders > 0 ? Math.round(s.revenue / s.paidOrders) : 0,
      },
      inventory: { lowStockSkus: i.lowStockSkus, outOfStockSkus: i.outOfStockSkus },
      customers: { newCustomers: c.newCustomers, repeatCustomers: c.repeatCustomers },
      social: { postsPublished: posts, inboxOpen, slaBreached },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Sales analytics                                                            */
/* -------------------------------------------------------------------------- */

export interface SalesAnalytics {
  range: { from: string; to: string };
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ productId: string; name: string; revenue: number; units: number }>;
  paymentMethodSplit: Array<{ method: string; orders: number; revenue: number }>;
  fulfilmentSummary: Array<{ status: string; orders: number }>;
}

export async function getSalesAnalytics(tenantId: string, range: DateRange = defaultRange()): Promise<SalesAnalytics> {
  return cached('sales', tenantId, range, async () => {
    const oid = tenantOid(tenantId);
    const [byDay, topProducts, methods, fulfilment] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            tenantId: oid,
            'payment.status': 'paid',
            createdAt: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$totals.total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            tenantId: oid,
            'payment.status': 'paid',
            createdAt: { $gte: range.from, $lte: range.to },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            revenue: { $sum: '$items.subtotal' },
            units: { $sum: '$items.qty' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        {
          $match: {
            tenantId: oid,
            createdAt: { $gte: range.from, $lte: range.to },
          },
        },
        {
          $group: {
            _id: '$payment.method',
            orders: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$totals.total', 0] } },
          },
        },
      ]),
      Order.aggregate([
        { $match: { tenantId: oid, createdAt: { $gte: range.from, $lte: range.to } } },
        { $group: { _id: '$status', orders: { $sum: 1 } } },
      ]),
    ]);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      revenueByDay: byDay.map((r: { _id: string; revenue: number; orders: number }) => ({
        date: r._id,
        revenue: r.revenue,
        orders: r.orders,
      })),
      topProducts: topProducts.map((p: { _id: Types.ObjectId; name: string; revenue: number; units: number }) => ({
        productId: String(p._id),
        name: p.name,
        revenue: p.revenue,
        units: p.units,
      })),
      paymentMethodSplit: methods.map((m: { _id: string; orders: number; revenue: number }) => ({
        method: m._id ?? 'unknown',
        orders: m.orders,
        revenue: m.revenue,
      })),
      fulfilmentSummary: fulfilment.map((f: { _id: string; orders: number }) => ({
        status: f._id,
        orders: f.orders,
      })),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Inventory analytics                                                        */
/* -------------------------------------------------------------------------- */

export interface InventoryAnalytics {
  totalSkus: number;
  totalUnitsOnHand: number;
  totalUnitsReserved: number;
  estimatedValue: number;
  lowStock: Array<{ sku: string; available: number; threshold: number; productName?: string }>;
  outOfStock: Array<{ sku: string; productName?: string }>;
}

export async function getInventoryAnalytics(tenantId: string): Promise<InventoryAnalytics> {
  return cached('inventory', tenantId, {}, async () => {
    const oid = tenantOid(tenantId);

    const [totals, low, out] = await Promise.all([
      Inventory.aggregate([
        { $match: { tenantId: oid } },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $group: {
            _id: null,
            totalSkus: { $sum: 1 },
            totalUnitsOnHand: { $sum: '$onHand' },
            totalUnitsReserved: { $sum: '$reserved' },
            estimatedValue: {
              $sum: { $multiply: ['$onHand', { $ifNull: [{ $arrayElemAt: ['$product.basePrice', 0] }, 0] }] },
            },
          },
        },
      ]),
      Inventory.aggregate([
        {
          $match: {
            tenantId: oid,
            threshold: { $gt: 0 },
            $expr: { $lte: ['$available', '$threshold'] },
          },
        },
        {
          $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' },
        },
        {
          $project: {
            sku: 1,
            available: 1,
            threshold: 1,
            productName: { $arrayElemAt: ['$product.name', 0] },
          },
        },
        { $sort: { available: 1 } },
        { $limit: 50 },
      ]),
      Inventory.find({ tenantId: oid, available: { $lte: 0 } })
        .limit(50)
        .lean(),
    ]);

    const t = totals[0] ?? { totalSkus: 0, totalUnitsOnHand: 0, totalUnitsReserved: 0, estimatedValue: 0 };
    return {
      totalSkus: t.totalSkus,
      totalUnitsOnHand: t.totalUnitsOnHand,
      totalUnitsReserved: t.totalUnitsReserved,
      estimatedValue: t.estimatedValue,
      lowStock: low.map((r: { sku: string; available: number; threshold: number; productName?: string }) => ({
        sku: r.sku,
        available: r.available,
        threshold: r.threshold,
        productName: r.productName,
      })),
      outOfStock: out.map((r) => ({ sku: r.sku })),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* CRM analytics                                                              */
/* -------------------------------------------------------------------------- */

export interface CRMAnalytics {
  range: { from: string; to: string };
  totals: { customers: number; newInRange: number; activeInRange: number };
  spendBuckets: Array<{ bucket: string; customers: number }>;
  topSpenders: Array<{ userId: string; email?: string; phone?: string; spend: number; orders: number }>;
  recentCommunications: number;
}

export async function getCRMAnalytics(tenantId: string, range: DateRange = defaultRange()): Promise<CRMAnalytics> {
  return cached('crm', tenantId, range, async () => {
    const oid = tenantOid(tenantId);

    const [totalCust, newCust, active, topSpenders, comms] = await Promise.all([
      User.countDocuments({ tenantId: oid, status: 'active' }),
      User.countDocuments({ tenantId: oid, createdAt: { $gte: range.from, $lte: range.to } }),
      Order.distinct('userId', { tenantId: oid, createdAt: { $gte: range.from, $lte: range.to } }),
      Order.aggregate([
        { $match: { tenantId: oid, 'payment.status': 'paid', userId: { $ne: null } } },
        {
          $group: {
            _id: '$userId',
            spend: { $sum: '$totals.total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { spend: -1 } },
        { $limit: 10 },
        {
          $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
        },
        {
          $project: {
            spend: 1,
            orders: 1,
            email: { $arrayElemAt: ['$user.email', 0] },
            phone: { $arrayElemAt: ['$user.phone', 0] },
          },
        },
      ]),
      CommunicationLog.countDocuments({
        tenantId: oid,
        createdAt: { $gte: range.from, $lte: range.to },
      }),
    ]);

    const spendBuckets = await Order.aggregate([
      { $match: { tenantId: oid, 'payment.status': 'paid', userId: { $ne: null } } },
      { $group: { _id: '$userId', spend: { $sum: '$totals.total' } } },
      {
        $bucket: {
          groupBy: '$spend',
          // values in minor units (cents/paisa); 100 = $1, so 10_000 = $100.
          boundaries: [0, 5_000_00, 10_000_00, 50_000_00, Number.MAX_SAFE_INTEGER],
          default: 'other',
          output: { customers: { $sum: 1 } },
        },
      },
    ]);

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: {
        customers: totalCust,
        newInRange: newCust,
        activeInRange: active.length,
      },
      spendBuckets: spendBuckets.map((b: { _id: number | string; customers: number }) => ({
        bucket: bucketLabel(b._id),
        customers: b.customers,
      })),
      topSpenders: topSpenders.map((s: { _id: Types.ObjectId; spend: number; orders: number; email?: string; phone?: string }) => ({
        userId: String(s._id),
        email: s.email,
        phone: s.phone,
        spend: s.spend,
        orders: s.orders,
      })),
      recentCommunications: comms,
    };
  });
}

function bucketLabel(start: number | string): string {
  const labels: Record<string, string> = {
    '0': '< $50',
    '50000': '$50 – $100',
    '100000': '$100 – $500',
    '500000': '$500+',
  };
  return labels[String(start)] ?? 'other';
}

/* -------------------------------------------------------------------------- */
/* Reviews + ratings (kept on the catalogue side for the analytics page)      */
/* -------------------------------------------------------------------------- */

export interface ReviewAnalytics {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Array<{ rating: number; count: number }>;
  topRatedProducts: Array<{ productId: string; name: string; avg: number; count: number }>;
}

export async function getReviewAnalytics(tenantId: string): Promise<ReviewAnalytics> {
  return cached('reviews', tenantId, {}, async () => {
    const oid = tenantOid(tenantId);
    const [agg, dist, top] = await Promise.all([
      Review.aggregate([
        { $match: { tenantId: oid, status: 'published' } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
      Review.aggregate([
        { $match: { tenantId: oid, status: 'published' } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Product.aggregate([
        { $match: { tenantId: oid, 'rating.count': { $gt: 0 } } },
        { $sort: { 'rating.avg': -1, 'rating.count': -1 } },
        { $limit: 10 },
        { $project: { name: 1, avg: '$rating.avg', count: '$rating.count' } },
      ]),
    ]);

    return {
      averageRating: agg[0]?.avg ?? 0,
      totalReviews: agg[0]?.count ?? 0,
      ratingDistribution: dist.map((d: { _id: number; count: number }) => ({
        rating: d._id,
        count: d.count,
      })),
      topRatedProducts: top.map((p: { _id: Types.ObjectId; name: string; avg: number; count: number }) => ({
        productId: String(p._id),
        name: p.name,
        avg: p.avg,
        count: p.count,
      })),
    };
  });
}
