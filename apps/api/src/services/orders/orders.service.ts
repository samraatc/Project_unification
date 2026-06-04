import { Types } from 'mongoose';

import {
  Inventory,
  Order,
  Refund,
  Return,
  StockMovement,
  type OrderDoc,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { releaseStockForItems } from '../catalogue/cart.service.js';
import { enqueueAllChannels } from '../notifications/outbox.service.js';
import { refundPayment } from '../payments/payments.service.js';
import { assertValidTransition, TERMINAL_STATES } from './stateMachine.js';

/**
 * Order operations service — FR-008.
 *
 * Every transition runs through `transitionStatus()` so the state-machine guard,
 * status-history write, inventory side-effects, audit log, and notification
 * outbox all happen consistently. Direct `order.status =` assignment is forbidden
 * outside this module.
 */

export interface TransitionInput {
  orderId: string;
  tenantId: string;
  to: OrderDoc['status'];
  actorId?: string;
  reason?: string;
  courierCode?: string;
  trackingNumber?: string;
  ip?: string;
  ua?: string;
}

export async function transitionStatus(input: TransitionInput): Promise<OrderDoc> {
  const order = await Order.findOne({ _id: input.orderId, tenantId: input.tenantId });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');

  const from = order.status;
  assertValidTransition(from, input.to);
  order.status = input.to;
  order.statusHistory = [
    ...(order.statusHistory ?? []),
    {
      from,
      to: input.to,
      changedBy: input.actorId ? (new Types.ObjectId(input.actorId) as unknown as Types.ObjectId) : undefined,
      reason: input.reason,
      ts: new Date(),
    } as OrderDoc['statusHistory'][number],
  ];

  // Status-specific side effects.
  if (input.to === 'shipped') {
    order.shipping = {
      ...(order.shipping ?? {}),
      courier: input.courierCode ?? order.shipping?.courier,
      trackingNumber: input.trackingNumber ?? order.shipping?.trackingNumber,
      shippedAt: new Date(),
    } as OrderDoc['shipping'];
    // Fulfil inventory: move reserved → out-the-door (decrement reserved + onHand).
    await fulfilInventoryForOrder(order);
  }

  if (input.to === 'delivered') {
    order.shipping = { ...(order.shipping ?? {}), deliveredAt: new Date() } as OrderDoc['shipping'];
  }

  if (input.to === 'cancelled') {
    // Release any reservation (only matters before `shipped`).
    if (from !== 'shipped' && from !== 'delivered') {
      await releaseStockForItems(
        String(order.tenantId),
        order.items.map((it) => ({ sku: it.sku, qty: it.qty })),
      );
    }
  }

  if (input.to === 'returned') {
    // Restock the items to available.
    await restockInventoryForOrder(order, 'return_restock');
  }

  await order.save();

  await audit({
    tenantId: order.tenantId,
    actorId: input.actorId,
    action: `order.status_${input.to}`,
    entity: 'Order',
    entityId: order._id,
    beforeJson: { status: from },
    afterJson: { status: input.to, reason: input.reason },
    ip: input.ip,
    ua: input.ua,
  });

  // Notify the customer (FR-010). Outbox respects per-channel opt-out at dispatch time.
  if (order.userId) {
    const template = `order.${input.to}`;
    await enqueueAllChannels({
      tenantId: String(order.tenantId),
      toUserId: String(order.userId),
      template,
      payload: {
        orderNumber: order.number,
        status: input.to,
        trackingNumber: order.shipping?.trackingNumber,
      },
      eventKey: `${template}:${order._id}`,
    });
  }

  return order;
}

async function fulfilInventoryForOrder(order: OrderDoc): Promise<void> {
  for (const item of order.items) {
    // eslint-disable-next-line no-await-in-loop -- per-SKU
    const updated = await Inventory.findOneAndUpdate(
      { tenantId: order.tenantId, sku: item.sku, reserved: { $gte: item.qty } },
      { $inc: { reserved: -item.qty, onHand: -item.qty } },
      { new: true },
    );
    if (updated) {
      // eslint-disable-next-line no-await-in-loop
      await StockMovement.create({
        tenantId: order.tenantId,
        sku: item.sku,
        type: 'order_fulfil',
        qtyChange: -item.qty,
        balanceAfter: updated.onHand,
        referenceType: 'Order',
        referenceId: order._id,
      });
    }
  }
}

async function restockInventoryForOrder(order: OrderDoc, type: 'return_restock' | 'order_reserve') {
  for (const item of order.items) {
    // eslint-disable-next-line no-await-in-loop
    const updated = await Inventory.findOneAndUpdate(
      { tenantId: order.tenantId, sku: item.sku },
      { $inc: { onHand: item.qty, available: item.qty } },
      { new: true },
    );
    if (updated) {
      // eslint-disable-next-line no-await-in-loop
      await StockMovement.create({
        tenantId: order.tenantId,
        sku: item.sku,
        type,
        qtyChange: item.qty,
        balanceAfter: updated.onHand,
        referenceType: 'Order',
        referenceId: order._id,
      });
    }
  }
}

export interface AddNoteInput {
  orderId: string;
  tenantId: string;
  actorId: string;
  body: string;
  internal?: boolean;
  ip?: string;
  ua?: string;
}

export async function addOrderNote(input: AddNoteInput): Promise<OrderDoc> {
  const order = await Order.findOne({ _id: input.orderId, tenantId: input.tenantId });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  order.notes = [
    ...(order.notes ?? []),
    {
      author: new Types.ObjectId(input.actorId),
      body: input.body,
      internal: Boolean(input.internal),
      ts: new Date(),
    } as OrderDoc['notes'][number],
  ];
  await order.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'order.note_added',
    entity: 'Order',
    entityId: order._id,
    ip: input.ip,
    ua: input.ua,
  });
  return order;
}

/* -------------------------------------------------------------------------- */
/* Returns + Refunds                                                          */
/* -------------------------------------------------------------------------- */

export interface RequestReturnInput {
  orderId: string;
  tenantId: string;
  userId: string;
  items: Array<{ orderItemId: string; qty: number; reason: string }>;
  photos?: string[];
  ip?: string;
  ua?: string;
}

export async function requestReturn(input: RequestReturnInput) {
  const order = await Order.findOne({ _id: input.orderId, tenantId: input.tenantId });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (String(order.userId) !== input.userId) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not own this order.');
  }
  if (!['delivered', 'shipped'].includes(order.status)) {
    throw new HttpError(409, 'NOT_RETURNABLE', 'Order is not in a returnable state.');
  }
  const ret = await Return.create({
    tenantId: order.tenantId,
    orderId: order._id,
    userId: input.userId,
    items: input.items.map((i) => ({
      orderItemId: new Types.ObjectId(i.orderItemId),
      sku: order.items.find((oi) => String(oi._id) === i.orderItemId)?.sku,
      qty: i.qty,
      reason: i.reason,
    })),
    photos: input.photos ?? [],
    status: 'requested',
  });
  await audit({
    tenantId: order.tenantId,
    actorId: input.userId,
    action: 'order.return_requested',
    entity: 'Return',
    entityId: ret._id,
    afterJson: { orderId: String(order._id) },
    ip: input.ip,
    ua: input.ua,
  });
  return ret;
}

export interface IssueRefundInput {
  orderId: string;
  tenantId: string;
  actorId: string;
  amount: number;
  returnId?: string;
  ip?: string;
  ua?: string;
}

export async function issueRefund(input: IssueRefundInput) {
  const order = await Order.findOne({ _id: input.orderId, tenantId: input.tenantId });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  if (TERMINAL_STATES.has(order.status) && order.status === 'cancelled') {
    throw new HttpError(409, 'CANNOT_REFUND', 'Cancelled orders cannot be refunded.');
  }
  if (order.payment?.status !== 'paid' && order.payment?.method !== 'cod') {
    throw new HttpError(409, 'NOT_PAID', 'Order is not in a paid state.');
  }
  const refund = await Refund.create({
    tenantId: order.tenantId,
    orderId: order._id,
    returnId: input.returnId,
    amount: input.amount,
    currency: order.currency ?? 'USD',
    gateway: order.payment.method,
    gatewayRef: order.payment.gatewayRef,
    status: 'pending',
    requestedBy: input.actorId,
  });

  const result = await refundPayment({
    method: order.payment.method,
    orderId: String(order._id),
    gatewayRef: order.payment.gatewayRef ?? '',
    amount: input.amount,
    currency: order.currency ?? 'USD',
  });

  if (result.ok) {
    refund.status = 'succeeded';
    refund.providerRefundId = result.providerRefundId;
    refund.processedAt = new Date();
    order.payment.status = 'refunded';
    if (!TERMINAL_STATES.has(order.status)) {
      order.statusHistory = [
        ...(order.statusHistory ?? []),
        {
          from: order.status,
          to: 'refunded',
          changedBy: new Types.ObjectId(input.actorId),
          reason: 'Refund issued',
          ts: new Date(),
        } as OrderDoc['statusHistory'][number],
      ];
      order.status = 'refunded';
    }
  } else {
    refund.status = 'failed';
    refund.error = result.message;
  }
  await Promise.all([refund.save(), order.save()]);

  await audit({
    tenantId: order.tenantId,
    actorId: input.actorId,
    action: 'order.refund_issued',
    entity: 'Refund',
    entityId: refund._id,
    afterJson: { amount: input.amount, status: refund.status },
    ip: input.ip,
    ua: input.ua,
  });

  if (order.userId && result.ok) {
    await enqueueAllChannels({
      tenantId: String(order.tenantId),
      toUserId: String(order.userId),
      template: 'order.refunded',
      payload: { orderNumber: order.number, amount: input.amount, currency: order.currency },
      eventKey: `order.refunded:${refund._id}`,
    });
  }

  return refund;
}
