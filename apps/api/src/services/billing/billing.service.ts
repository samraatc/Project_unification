import { Subscription, type SubscriptionDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { redis } from '../../infra/redis.js';
import { audit } from '../audit.service.js';
import { enqueueAllChannels } from '../notifications/outbox.service.js';
import { GRACE_PERIOD_DAYS, planFor, type PlanCode } from './plans.js';
import { billingProviderFor, type BillingProviderCode } from './providers/index.js';

/**
 * Billing service — FR-016.
 *
 * Owns subscription transitions, the entitlement cache, and the dunning state
 * machine surface. Provider-side mutations go through `billingProviderFor()`
 * so callers don't fan out per provider.
 */

const ENTITLEMENT_CACHE_PREFIX = 'entitlements:';
const ENTITLEMENT_TTL_SECONDS = 5 * 60;

export async function entitlementsFor(tenantId: string): Promise<string[]> {
  const cached = await redis.get(`${ENTITLEMENT_CACHE_PREFIX}${tenantId}`);
  if (cached) {
    try {
      return JSON.parse(cached) as string[];
    } catch {
      // fall through
    }
  }
  const sub = await Subscription.findOne({ tenantId }).select('entitlements status').lean();
  const list = sub && (sub.status === 'active' || sub.status === 'grace' || sub.status === 'trial')
    ? sub.entitlements ?? []
    : [];
  await redis.set(`${ENTITLEMENT_CACHE_PREFIX}${tenantId}`, JSON.stringify(list), 'EX', ENTITLEMENT_TTL_SECONDS);
  return list;
}

export async function invalidateEntitlements(tenantId: string): Promise<void> {
  await redis.del(`${ENTITLEMENT_CACHE_PREFIX}${tenantId}`);
}

/* -------------------------------------------------------------------------- */
/* Plans                                                                      */
/* -------------------------------------------------------------------------- */

export interface StartCheckoutInput {
  tenantId: string;
  actorId: string;
  plan: PlanCode;
  provider: BillingProviderCode;
  returnUrl: string;
  cancelUrl: string;
  customer: { email?: string; phone?: string; name?: string };
  ip?: string;
  ua?: string;
}

export async function startCheckout(input: StartCheckoutInput) {
  const planDef = planFor(input.plan);
  const provider = billingProviderFor(input.provider);
  const handoff = await provider.createCheckout({
    tenantId: input.tenantId,
    plan: planDef,
    returnUrl: input.returnUrl,
    cancelUrl: input.cancelUrl,
    customer: input.customer,
  });

  await Subscription.updateOne(
    { tenantId: input.tenantId },
    {
      $setOnInsert: {
        tenantId: input.tenantId,
        plan: planDef.code,
        status: planDef.trialDays ? 'trial' : 'past_due',
        cycle: planDef.cycle,
        seats: planDef.seats,
        amountMinor: input.provider === 'stripe' ? planDef.amountUsd : planDef.amountNpr,
        currency: input.provider === 'stripe' ? 'USD' : 'NPR',
        entitlements: planDef.trialDays ? planDef.entitlements : [],
        startedAt: new Date(),
        currentPeriodEnd: planDef.trialDays
          ? new Date(Date.now() + planDef.trialDays * 24 * 3600 * 1000)
          : undefined,
        gateway: {
          provider: input.provider,
          customerRef: handoff.customerRef,
          subscriptionRef: handoff.subscriptionRef,
        },
      },
      $push: {
        history: { event: 'checkout.started', payload: { provider: input.provider, plan: planDef.code } },
      },
    },
    { upsert: true },
  );

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'billing.checkout_started',
    entity: 'Subscription',
    afterJson: { plan: planDef.code, provider: input.provider },
    ip: input.ip,
    ua: input.ua,
  });

  return handoff;
}

/* -------------------------------------------------------------------------- */
/* Webhook ingest                                                             */
/* -------------------------------------------------------------------------- */

export interface IngestWebhookInput {
  provider: BillingProviderCode;
  externalEventId: string;
  type:
    | 'subscription.created'
    | 'subscription.renewed'
    | 'subscription.cancelled'
    | 'subscription.payment_failed'
    | 'subscription.payment_succeeded'
    | 'unknown';
  subscriptionRef?: string;
  amountMinor?: number;
}

export async function ingestBillingEvent(input: IngestWebhookInput): Promise<void> {
  if (!input.subscriptionRef) return;
  const sub = await Subscription.findOne({ 'gateway.subscriptionRef': input.subscriptionRef });
  if (!sub) return;

  const before = sub.status;
  switch (input.type) {
    case 'subscription.created':
    case 'subscription.payment_succeeded':
    case 'subscription.renewed': {
      sub.status = 'active';
      sub.entitlements = planFor(sub.plan as PlanCode).entitlements as string[];
      sub.dunning = { attempts: 0 } as SubscriptionDoc['dunning'];
      sub.history.push({ event: input.type, at: new Date() } as SubscriptionDoc['history'][number]);
      break;
    }
    case 'subscription.payment_failed': {
      sub.status = 'past_due';
      sub.dunning = {
        attempts: (sub.dunning?.attempts ?? 0) + 1,
        lastAttemptAt: new Date(),
        nextAttemptAt: nextDunningAttemptAt((sub.dunning?.attempts ?? 0) + 1),
      } as SubscriptionDoc['dunning'];
      sub.history.push({ event: input.type, at: new Date() } as SubscriptionDoc['history'][number]);
      break;
    }
    case 'subscription.cancelled': {
      sub.status = 'cancelled';
      sub.cancelledAt = new Date();
      sub.entitlements = [];
      sub.history.push({ event: input.type, at: new Date() } as SubscriptionDoc['history'][number]);
      break;
    }
    default:
      sub.history.push({ event: 'unknown', at: new Date(), payload: input } as SubscriptionDoc['history'][number]);
  }

  await sub.save();
  await invalidateEntitlements(String(sub.tenantId));
  await audit({
    tenantId: sub.tenantId,
    action: `billing.${input.type}`,
    entity: 'Subscription',
    entityId: sub._id,
    beforeJson: { status: before },
    afterJson: { status: sub.status, entitlements: sub.entitlements },
  });
}

/* -------------------------------------------------------------------------- */
/* Dunning                                                                    */
/* -------------------------------------------------------------------------- */

const DUNNING_DAY_OFFSETS = [1, 3, 7];
const DOWNGRADE_AFTER_DAYS = 14;

export function nextDunningAttemptAt(attemptNumber: number): Date | undefined {
  const offset = DUNNING_DAY_OFFSETS[attemptNumber - 1];
  if (offset === undefined) return undefined;
  return new Date(Date.now() + offset * 24 * 3600 * 1000);
}

/** Worker entry point — called by `dunning-retry` BullMQ job. */
export async function tickDunning(): Promise<void> {
  const now = new Date();
  const due = await Subscription.find({
    status: 'past_due',
    'dunning.nextAttemptAt': { $lte: now },
  });
  for (const sub of due) {
    const provider = billingProviderFor(sub.gateway?.provider as BillingProviderCode);
    // eslint-disable-next-line no-await-in-loop
    const result = await provider.retryPayment({
      customerRef: sub.gateway?.customerRef,
      subscriptionRef: sub.gateway?.subscriptionRef,
      amountMinor: sub.amountMinor ?? 0,
      currency: sub.currency ?? 'USD',
    });
    if (result.ok) {
      sub.status = 'active';
      sub.entitlements = planFor(sub.plan as PlanCode).entitlements as string[];
      sub.dunning = { attempts: 0 } as SubscriptionDoc['dunning'];
      sub.history.push({ event: 'dunning.retry_success', at: now } as SubscriptionDoc['history'][number]);
    } else {
      const nextAttempt = (sub.dunning?.attempts ?? 0) + 1;
      const nextAt = nextDunningAttemptAt(nextAttempt);
      const ageDays = sub.dunning?.lastAttemptAt
        ? (now.getTime() - sub.dunning.lastAttemptAt.getTime()) / 86_400_000
        : 0;
      if (nextAt === undefined || ageDays >= DOWNGRADE_AFTER_DAYS) {
        sub.status = 'expired';
        sub.entitlements = [];
        sub.history.push({ event: 'dunning.downgraded', at: now } as SubscriptionDoc['history'][number]);
      } else {
        sub.dunning = {
          attempts: nextAttempt,
          lastAttemptAt: now,
          nextAttemptAt: nextAt,
        } as SubscriptionDoc['dunning'];
        sub.status = ageDays > GRACE_PERIOD_DAYS ? 'grace' : 'past_due';
        sub.history.push({
          event: 'dunning.retry_failed',
          at: now,
          payload: { attempt: nextAttempt, ageDays },
        } as SubscriptionDoc['history'][number]);
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await sub.save();
    // eslint-disable-next-line no-await-in-loop
    await invalidateEntitlements(String(sub.tenantId));
    // eslint-disable-next-line no-await-in-loop
    await enqueueAllChannels({
      tenantId: String(sub.tenantId),
      toUserId: String(sub.tenantId), // tenant owner notification — refined in 6.6
      template: `billing.${result.ok ? 'retry_success' : 'retry_failed'}`,
      payload: { plan: sub.plan, status: sub.status },
      eventKey: `billing.${sub._id}.${nextDunningKey(now)}`,
    });
  }
}

function nextDunningKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCHours()}`;
}

/* -------------------------------------------------------------------------- */
/* Customer cancel                                                            */
/* -------------------------------------------------------------------------- */

export interface CancelSubscriptionInput {
  tenantId: string;
  actorId: string;
  reason?: string;
}

export async function cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
  const sub = await Subscription.findOne({ tenantId: input.tenantId });
  if (!sub) throw new HttpError(404, 'NO_SUBSCRIPTION', 'No subscription found.');
  if (sub.gateway?.provider) {
    const provider = billingProviderFor(sub.gateway.provider as BillingProviderCode);
    await provider.cancel({
      customerRef: sub.gateway.customerRef,
      subscriptionRef: sub.gateway.subscriptionRef,
      reason: input.reason,
    });
  }
  sub.status = 'cancelled';
  sub.cancelledAt = new Date();
  sub.entitlements = [];
  sub.history.push({ event: 'cancelled', at: new Date(), payload: { reason: input.reason } } as SubscriptionDoc['history'][number]);
  await sub.save();
  await invalidateEntitlements(String(sub.tenantId));
  await audit({
    tenantId: sub.tenantId,
    actorId: input.actorId,
    action: 'billing.cancelled',
    entity: 'Subscription',
    entityId: sub._id,
    afterJson: { reason: input.reason },
  });
}
