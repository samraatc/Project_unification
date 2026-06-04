import { createHash } from 'node:crypto';

import { AuditChainHead, AuditLog } from '../../db/models/index.js';

/**
 * Tamper-evident audit chain — D-0018.
 *
 * For every premium (`premium: true`) audit log row, compute
 *   chainHash = sha256(prevHash + canonicalJson(entry))
 * and update the per-tenant `auditChainHeads` row. The worker calls this on a
 * loop so the chain progress is observable even if the writer crashes mid-batch.
 */

function canonical(entry: Record<string, unknown>): string {
  const subset = {
    id: String(entry._id),
    tenantId: String(entry.tenantId),
    actorId: entry.actorId ? String(entry.actorId) : null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ? String(entry.entityId) : null,
    afterJson: entry.afterJson ?? null,
    ts: entry.ts instanceof Date ? entry.ts.toISOString() : entry.ts,
  };
  return JSON.stringify(subset);
}

export async function advanceChainForTenant(tenantId: string): Promise<{ added: number; head: string }> {
  const head = await AuditChainHead.findOneAndUpdate(
    { tenantId },
    { $setOnInsert: { headHash: '', chainLength: 0 } },
    { upsert: true, new: true },
  );

  const unchained = await AuditLog.find({
    tenantId,
    premium: true,
    chainHash: { $exists: false },
  })
    .sort({ _id: 1 })
    .limit(500)
    .lean();

  let prev = head.headHash ?? '';
  let added = 0;
  for (const row of unchained) {
    const chainHash = createHash('sha256').update(prev).update(canonical(row as unknown as Record<string, unknown>)).digest('hex');
    // eslint-disable-next-line no-await-in-loop -- single-tenant chain is naturally serial
    await AuditLog.collection.updateOne(
      { _id: row._id },
      { $set: { chainPrevHash: prev, chainHash } },
    );
    prev = chainHash;
    added++;
  }

  if (added > 0) {
    head.headHash = prev;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose ObjectId
    head.headEntryId = unchained[unchained.length - 1]?._id as any;
    head.chainLength = (head.chainLength ?? 0) + added;
    head.lastUpdatedAt = new Date();
    await head.save();
  }
  return { added, head: prev };
}

/**
 * Verifier — replays the chain from genesis and confirms every linked hash.
 * Used by `audit-pack` export to attach a proof-of-integrity certificate.
 */
export async function verifyChain(tenantId: string): Promise<{ valid: boolean; checked: number; firstBadAt?: string }> {
  const rows = await AuditLog.find({ tenantId, premium: true })
    .select('_id action ts chainPrevHash chainHash actorId entity entityId afterJson')
    .sort({ _id: 1 })
    .lean();
  let prev = '';
  let checked = 0;
  for (const row of rows) {
    const expected = createHash('sha256').update(prev).update(canonical(row as unknown as Record<string, unknown>)).digest('hex');
    if (row.chainHash && expected !== row.chainHash) {
      return { valid: false, checked, firstBadAt: String(row._id) };
    }
    if (row.chainHash) {
      prev = row.chainHash;
      checked++;
    }
  }
  return { valid: true, checked };
}
