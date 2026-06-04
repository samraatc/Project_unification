import {
  CustomerTag,
  Inventory,
  Order,
  User,
} from '../../db/models/index.js';
import type { ReportDataset } from './formats.js';

/**
 * Report definitions registry.
 *
 * Each key in the registry maps to a function that returns a `ReportDataset`.
 * The window helper standardises the optional time range that scheduled
 * reports pass in via `windowSpec`.
 */

export type ReportKey = 'sales_summary' | 'inventory_snapshot' | 'customer_segments' | 'orders_full';

export interface ReportContext {
  tenantId: string;
  from: Date;
  to: Date;
}

export const WINDOW_TO_DAYS: Record<string, number> = {
  last_24h: 1,
  last_7d: 7,
  last_30d: 30,
  last_90d: 90,
};

export function resolveWindow(windowSpec: keyof typeof WINDOW_TO_DAYS | undefined): { from: Date; to: Date } {
  const days = WINDOW_TO_DAYS[windowSpec ?? 'last_7d'] ?? 7;
  return {
    from: new Date(Date.now() - days * 24 * 3600 * 1000),
    to: new Date(),
  };
}

export const REPORT_DEFINITIONS: Record<ReportKey, (ctx: ReportContext) => Promise<ReportDataset>> = {
  sales_summary: async (ctx) => {
    const docs = await Order.aggregate([
      { $match: { tenantId: ctx.tenantId, createdAt: { $gte: ctx.from, $lte: ctx.to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$payment.status', 'paid'] }, '$totals.total', 0] } },
          refunded: { $sum: { $cond: [{ $eq: ['$payment.status', 'refunded'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const rows = docs.map((d: { _id: string; orders: number; paid: number; revenue: number; refunded: number }) => ({
      date: d._id,
      orders: d.orders,
      paid: d.paid,
      refunded: d.refunded,
      revenue: d.revenue,
    }));
    const totals = rows.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        paid: acc.paid + r.paid,
        refunded: acc.refunded + r.refunded,
        revenue: acc.revenue + r.revenue,
      }),
      { orders: 0, paid: 0, refunded: 0, revenue: 0 },
    );
    return {
      title: 'Sales summary',
      generatedAt: new Date(),
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'orders', header: 'Orders' },
        { key: 'paid', header: 'Paid' },
        { key: 'refunded', header: 'Refunded' },
        { key: 'revenue', header: 'Revenue (minor units)' },
      ],
      rows,
      totals: { date: 'Total', ...totals },
    };
  },

  inventory_snapshot: async (ctx) => {
    const docs = await Inventory.aggregate([
      { $match: { tenantId: ctx.tenantId } },
      {
        $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' },
      },
      {
        $project: {
          sku: 1,
          onHand: 1,
          reserved: 1,
          available: 1,
          threshold: 1,
          productName: { $arrayElemAt: ['$product.name', 0] },
          basePrice: { $arrayElemAt: ['$product.basePrice', 0] },
        },
      },
    ]);
    const rows = docs.map((d: { sku: string; onHand: number; reserved: number; available: number; threshold: number; productName?: string; basePrice?: number }) => ({
      sku: d.sku,
      productName: d.productName ?? '',
      onHand: d.onHand,
      reserved: d.reserved,
      available: d.available,
      threshold: d.threshold,
      estimatedValue: (d.onHand ?? 0) * (d.basePrice ?? 0),
    }));
    return {
      title: 'Inventory snapshot',
      generatedAt: new Date(),
      columns: [
        { key: 'sku', header: 'SKU' },
        { key: 'productName', header: 'Product' },
        { key: 'onHand', header: 'On hand' },
        { key: 'reserved', header: 'Reserved' },
        { key: 'available', header: 'Available' },
        { key: 'threshold', header: 'Threshold' },
        { key: 'estimatedValue', header: 'Est. value (minor units)' },
      ],
      rows,
    };
  },

  customer_segments: async (ctx) => {
    const [spend, tags] = await Promise.all([
      Order.aggregate([
        { $match: { tenantId: ctx.tenantId, 'payment.status': 'paid', userId: { $ne: null } } },
        { $group: { _id: '$userId', spend: { $sum: '$totals.total' }, orders: { $sum: 1 } } },
      ]),
      CustomerTag.aggregate([
        { $match: { tenantId: ctx.tenantId } },
        { $group: { _id: '$userId', tags: { $push: '$tag' } } },
      ]),
    ]);
    const tagMap = new Map<string, string[]>(tags.map((t: { _id: string; tags: string[] }) => [String(t._id), t.tags]));
    const userIds = spend.map((s: { _id: string }) => s._id);
    const users = await User.find({ _id: { $in: userIds } }).select('email phone profile').lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const rows = spend.map((s: { _id: string; spend: number; orders: number }) => {
      const u = userMap.get(String(s._id));
      const segs: string[] = [];
      if (s.spend >= 50_000_00) segs.push('vip');
      if (s.orders > 1) segs.push('repeat');
      if (s.orders === 1) segs.push('first_time');
      return {
        userId: String(s._id),
        name: [u?.profile?.firstName, u?.profile?.lastName].filter(Boolean).join(' ') || '',
        email: u?.email ?? '',
        phone: u?.phone ?? '',
        orders: s.orders,
        spend: s.spend,
        segments: segs.join(','),
        tags: (tagMap.get(String(s._id)) ?? []).join(','),
      };
    });

    return {
      title: 'Customer segments',
      generatedAt: new Date(),
      columns: [
        { key: 'userId', header: 'User ID' },
        { key: 'name', header: 'Name' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'orders', header: 'Orders' },
        { key: 'spend', header: 'Spend (minor units)' },
        { key: 'segments', header: 'Segments' },
        { key: 'tags', header: 'Tags' },
      ],
      rows,
    };
  },

  orders_full: async (ctx) => {
    const docs = await Order.find({ tenantId: ctx.tenantId, createdAt: { $gte: ctx.from, $lte: ctx.to } })
      .select('number status payment.method payment.status totals.total currency userId guestEmail createdAt')
      .lean();
    return {
      title: 'Orders (full export)',
      generatedAt: new Date(),
      columns: [
        { key: 'number', header: 'Order #' },
        { key: 'createdAt', header: 'Placed' },
        { key: 'status', header: 'Status' },
        { key: 'method', header: 'Payment method' },
        { key: 'paymentStatus', header: 'Payment status' },
        { key: 'total', header: 'Total (minor units)' },
        { key: 'currency', header: 'Currency' },
        { key: 'identifier', header: 'Customer ID/email' },
      ],
      rows: docs.map((d) => ({
        number: d.number,
        createdAt: d.createdAt ? new Date(d.createdAt as unknown as string).toISOString() : '',
        status: d.status,
        method: d.payment?.method,
        paymentStatus: d.payment?.status,
        total: d.totals?.total ?? 0,
        currency: d.currency,
        identifier: String(d.userId ?? d.guestEmail ?? ''),
      })),
    };
  },
};
