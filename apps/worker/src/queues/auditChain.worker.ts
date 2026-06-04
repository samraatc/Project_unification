/**
 * Audit-chain worker — D-0018.
 *
 * Polls every 30 seconds for premium-scope audit log rows missing a chain
 * hash, computes `sha256(prevHash + canonicalJson(entry))`, and updates the
 * `auditChainHeads` row per tenant.
 */
import type IORedis from 'ioredis';
import type { Logger } from 'pino';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { AuditChainHead, AuditLog } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { advanceChainForTenant } from '../../../api/src/services/accounting/auditChain.service.js';

export function startAuditChainWorker(_redis: IORedis, logger: Logger): { close: () => Promise<void> } {
  const interval = setInterval(() => {
    void (async () => {
      // Find tenants with unchained premium entries; advance each.
      const tenants = await AuditLog.distinct('tenantId', { premium: true, chainHash: { $exists: false } });
      for (const tenantId of tenants) {
        // eslint-disable-next-line no-await-in-loop -- one tenant at a time keeps the chain serial
        const result = await advanceChainForTenant(String(tenantId));
        if (result.added > 0) {
          logger.info({ tenantId: String(tenantId), added: result.added, head: result.head.slice(0, 12) }, 'audit chain advanced');
        }
      }
    })().catch((err) => logger.error({ err }, 'audit chain tick failed'));
  }, 30_000);
  interval.unref();
  void AuditChainHead;
  return {
    async close() {
      clearInterval(interval);
    },
  };
}
