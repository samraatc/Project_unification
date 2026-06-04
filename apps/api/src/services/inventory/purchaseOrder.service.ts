import { randomBytes } from 'node:crypto';

import { PurchaseOrder, type PurchaseOrderDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { adjustStock } from './inventory.service.js';

function makePONumber(): string {
  return `PO-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

export interface CreatePOInput {
  tenantId: string;
  actorId: string;
  supplier: { name: string; contact?: string; address?: string };
  items: Array<{ sku: string; qtyOrdered: number; unitCost: number }>;
  expectedAt?: Date;
  notes?: string;
  ip?: string;
  ua?: string;
}

export async function createPurchaseOrder(input: CreatePOInput): Promise<PurchaseOrderDoc> {
  const po = await PurchaseOrder.create({
    tenantId: input.tenantId,
    number: makePONumber(),
    supplier: input.supplier,
    items: input.items,
    expectedAt: input.expectedAt,
    notes: input.notes,
    status: 'draft',
    createdBy: input.actorId,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'po.created',
    entity: 'PurchaseOrder',
    entityId: po._id,
    afterJson: { number: po.number, supplier: input.supplier.name },
    ip: input.ip,
    ua: input.ua,
  });
  return po;
}

export async function sendPurchaseOrder(input: { poId: string; tenantId: string; actorId: string; ip?: string; ua?: string }) {
  const po = await PurchaseOrder.findOne({ _id: input.poId, tenantId: input.tenantId });
  if (!po) throw new HttpError(404, 'PO_NOT_FOUND', 'Purchase order not found.');
  if (po.status !== 'draft') throw new HttpError(409, 'INVALID_STATUS', 'Only draft POs can be sent.');
  po.status = 'sent';
  await po.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'po.sent',
    entity: 'PurchaseOrder',
    entityId: po._id,
    ip: input.ip,
    ua: input.ua,
  });
  return po;
}

export interface ReceivePOInput {
  poId: string;
  tenantId: string;
  actorId: string;
  items: Array<{ sku: string; qty: number }>;
  ip?: string;
  ua?: string;
}

export async function receivePurchaseOrder(input: ReceivePOInput): Promise<PurchaseOrderDoc> {
  const po = await PurchaseOrder.findOne({ _id: input.poId, tenantId: input.tenantId });
  if (!po) throw new HttpError(404, 'PO_NOT_FOUND', 'Purchase order not found.');
  if (!['sent', 'partial'].includes(po.status)) {
    throw new HttpError(409, 'INVALID_STATUS', `Cannot receive a ${po.status} PO.`);
  }

  for (const incoming of input.items) {
    const line = po.items.find((i) => i.sku === incoming.sku);
    if (!line) continue;
    line.qtyReceived = (line.qtyReceived ?? 0) + incoming.qty;
    // eslint-disable-next-line no-await-in-loop -- per-SKU
    await adjustStock({
      tenantId: input.tenantId,
      sku: incoming.sku,
      delta: incoming.qty,
      reason: `PO receive ${po.number}`,
      actorId: input.actorId,
      type: 'po_receive',
      referenceType: 'PurchaseOrder',
      referenceId: String(po._id),
    });
  }

  const fullyReceived = po.items.every((i) => (i.qtyReceived ?? 0) >= i.qtyOrdered);
  po.status = fullyReceived ? 'received' : 'partial';
  if (fullyReceived) po.receivedAt = new Date();
  await po.save();

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: fullyReceived ? 'po.received' : 'po.partial_received',
    entity: 'PurchaseOrder',
    entityId: po._id,
    afterJson: { received: input.items },
    ip: input.ip,
    ua: input.ua,
  });
  return po;
}
