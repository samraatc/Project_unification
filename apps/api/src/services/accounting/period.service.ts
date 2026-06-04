import { AccountingPeriod } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';

/**
 * Period close/reopen. PRD §3.6 — close locks new journal posts within the
 * window; only Super Admin can reopen (enforced at the route layer).
 */

export interface CreatePeriodInput {
  tenantId: string;
  actorId: string;
  type: 'month' | 'quarter' | 'year';
  startsAt: Date;
  endsAt: Date;
}

export async function createPeriod(input: CreatePeriodInput) {
  const doc = await AccountingPeriod.create({
    tenantId: input.tenantId,
    type: input.type,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: 'open',
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'period.created',
    entity: 'AccountingPeriod',
    entityId: doc._id,
    afterJson: { type: input.type, startsAt: input.startsAt.toISOString() },
    premium: true,
  });
  return doc;
}

export async function closePeriod(input: { periodId: string; tenantId: string; actorId: string }) {
  const period = await AccountingPeriod.findOne({ _id: input.periodId, tenantId: input.tenantId });
  if (!period) throw new HttpError(404, 'PERIOD_NOT_FOUND', 'Period not found.');
  if (period.status !== 'open') throw new HttpError(409, 'NOT_OPEN', 'Only open periods can be closed.');
  period.status = 'closed';
  period.closedAt = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose accepts string for ObjectId field
  period.closedBy = input.actorId as any;
  await period.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'period.closed',
    entity: 'AccountingPeriod',
    entityId: period._id,
    premium: true,
  });
  return period;
}

export async function reopenPeriod(input: { periodId: string; tenantId: string; actorId: string }) {
  const period = await AccountingPeriod.findOne({ _id: input.periodId, tenantId: input.tenantId });
  if (!period) throw new HttpError(404, 'PERIOD_NOT_FOUND', 'Period not found.');
  if (period.status === 'locked') throw new HttpError(409, 'LOCKED', 'Locked periods cannot be reopened.');
  period.status = 'open';
  period.reopenedAt = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  period.reopenedBy = input.actorId as any;
  await period.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'period.reopened',
    entity: 'AccountingPeriod',
    entityId: period._id,
    premium: true,
  });
  return period;
}

export async function lockPeriod(input: { periodId: string; tenantId: string; actorId: string }) {
  const period = await AccountingPeriod.findOne({ _id: input.periodId, tenantId: input.tenantId });
  if (!period) throw new HttpError(404, 'PERIOD_NOT_FOUND', 'Period not found.');
  period.status = 'locked';
  period.lockedAt = new Date();
  await period.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'period.locked',
    entity: 'AccountingPeriod',
    entityId: period._id,
    premium: true,
  });
  return period;
}
