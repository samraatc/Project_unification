import { createHash } from 'node:crypto';

import { AuditLog, Invoice, JournalEntry } from '../../db/models/index.js';
import { audit } from '../audit.service.js';
import { trialBalance, generalLedger } from './reports.service.js';
import { verifyChain } from './auditChain.service.js';

/**
 * Audit pack export — Security-Requirements §9 + PRD §3.6.
 *
 * Bundles trial balance + general ledger + invoices + the audit log range into
 * a single manifest, computes a SHA-256 over the manifest, and stores the ZIP in
 * S3. Phase 6.5 ships the manifest builder; the real ZIP + S3 upload + signed
 * URL is the follow-up that reuses the Phase 5 report-artefact storage path.
 */

export interface AuditPackInput {
  tenantId: string;
  actorId: string;
  from: Date;
  to: Date;
  ip?: string;
  ua?: string;
}

export interface AuditPackManifest {
  tenantId: string;
  generatedAt: string;
  from: string;
  to: string;
  trialBalance: unknown;
  journalEntryCount: number;
  invoiceCount: number;
  auditEntryCount: number;
  chainVerification: { valid: boolean; checked: number };
  packHash: string;
  signedBy: string;
}

export async function buildAuditPack(input: AuditPackInput): Promise<AuditPackManifest> {
  const [tb, journalCount, invoiceCount, auditCount, chain] = await Promise.all([
    trialBalance({ tenantId: input.tenantId, asOf: input.to }),
    JournalEntry.countDocuments({ tenantId: input.tenantId, postedAt: { $gte: input.from, $lte: input.to } }),
    Invoice.countDocuments({ tenantId: input.tenantId, issuedAt: { $gte: input.from, $lte: input.to } }),
    AuditLog.countDocuments({ tenantId: input.tenantId, ts: { $gte: input.from, $lte: input.to } }),
    verifyChain(input.tenantId),
  ]);

  const partial = {
    tenantId: input.tenantId,
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    trialBalance: tb,
    journalEntryCount: journalCount,
    invoiceCount,
    auditEntryCount: auditCount,
    chainVerification: { valid: chain.valid, checked: chain.checked },
  };
  const packHash = createHash('sha256').update(JSON.stringify(partial)).digest('hex');
  const manifest: AuditPackManifest = {
    ...partial,
    generatedAt: new Date().toISOString(),
    packHash,
    signedBy: input.actorId,
  };

  // Suppress lint that an unused `generalLedger` import sometimes lands; we keep
  // the import so adding the per-account ledger to the pack is a localised diff.
  void generalLedger;

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'audit.pack_exported',
    entity: 'Tenant',
    afterJson: { packHash, range: { from: partial.from, to: partial.to } },
    ip: input.ip,
    ua: input.ua,
    premium: true,
  });

  return manifest;
}
