import type { Types } from 'mongoose';

import { AuditLog } from '../db/models/index.js';
import { logger } from '../config/logger.js';

export interface AuditEvent {
  tenantId: string | Types.ObjectId;
  actorId?: string | Types.ObjectId;
  action: string;
  entity: string;
  entityId?: string | Types.ObjectId;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string;
  ua?: string;
  requestId?: string;
  premium?: boolean;
}

/**
 * Single entry point for audit log writes. Every mutation goes through this.
 *
 * Phase 6 will extend the `premium` path to write the tamper-evident SHA-256 chain
 * onto a separate cluster with WORM-mounted shards (Sprint 0 decision).
 */
export async function audit(event: AuditEvent): Promise<void> {
  try {
    await AuditLog.create({
      ...event,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose accepts string or ObjectId here
      tenantId: event.tenantId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actorId: event.actorId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entityId: event.entityId as any,
    });
  } catch (err) {
    // Never fail the request because the audit log write failed; alert instead.
    logger.error({ err, event }, 'audit log write failed');
  }
}
