import { Inventory, StockMovement, type InventoryDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { enqueueNotification } from '../notifications/outbox.service.js';

/**
 * Inventory operations service — FR-009.
 *
 * Every adjustment goes through here so the `stockMovements` ledger stays the
 * authoritative source of truth. Low-stock detection enqueues a single admin
 * notification per SKU per crossing (deduped via `eventKey`).
 */

export interface AdjustInput {
  tenantId: string;
  sku: string;
  delta: number;
  reason: string;
  actorId: string;
  type?: 'adjustment' | 'write_off' | 'po_receive' | 'return_restock';
  referenceType?: string;
  referenceId?: string;
  ip?: string;
  ua?: string;
}

export async function adjustStock(input: AdjustInput): Promise<InventoryDoc> {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new HttpError(400, 'INVALID_DELTA', 'Delta must be a non-zero number.');
  }
  const updated = await Inventory.findOneAndUpdate(
    { tenantId: input.tenantId, sku: input.sku },
    { $inc: { onHand: input.delta, available: input.delta }, $set: { lastAdjustedAt: new Date() } },
    { new: true, upsert: true },
  );
  await StockMovement.create({
    tenantId: input.tenantId,
    sku: input.sku,
    type: input.type ?? 'adjustment',
    qtyChange: input.delta,
    balanceAfter: updated.onHand,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    userId: input.actorId,
    reason: input.reason,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'inventory.adjusted',
    entity: 'Inventory',
    entityId: updated._id,
    afterJson: { sku: input.sku, delta: input.delta, balanceAfter: updated.onHand, reason: input.reason },
    ip: input.ip,
    ua: input.ua,
  });

  if (updated.threshold > 0 && updated.available <= updated.threshold) {
    await enqueueNotification({
      tenantId: input.tenantId,
      channel: 'email',
      template: 'inventory.low_stock',
      payload: { sku: input.sku, available: updated.available, threshold: updated.threshold },
      eventKey: `inv.low:${input.sku}:${Math.floor(Date.now() / 86_400_000)}`,
    });
  }
  return updated;
}

export interface SetThresholdInput {
  tenantId: string;
  sku: string;
  threshold: number;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function setThreshold(input: SetThresholdInput): Promise<InventoryDoc | null> {
  const updated = await Inventory.findOneAndUpdate(
    { tenantId: input.tenantId, sku: input.sku },
    { $set: { threshold: input.threshold } },
    { new: true },
  );
  if (!updated) throw new HttpError(404, 'SKU_NOT_FOUND', 'No inventory row for that SKU.');
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'inventory.threshold_set',
    entity: 'Inventory',
    entityId: updated._id,
    afterJson: { sku: input.sku, threshold: input.threshold },
    ip: input.ip,
    ua: input.ua,
  });
  return updated;
}

export async function listLowStock(tenantId: string): Promise<InventoryDoc[]> {
  return Inventory.find({ tenantId, $expr: { $lte: ['$available', '$threshold'] }, threshold: { $gt: 0 } })
    .sort({ available: 1 })
    .lean();
}
