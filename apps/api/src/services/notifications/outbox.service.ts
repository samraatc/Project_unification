import { NotificationOutbox, User } from '../../db/models/index.js';

/**
 * The single entry point for writing to the notification outbox.
 *
 * Every domain event (order paid, order shipped, low stock, etc.) calls
 * `enqueue()` with an `eventKey` to dedupe. The `notifications-dispatch`
 * worker drains the outbox and routes to the right channel adapter; per-channel
 * opt-out is checked at dispatch time so a flipped preference still applies
 * to in-flight rows.
 */

export type Channel = 'email' | 'sms' | 'push';

export interface EnqueueInput {
  tenantId: string;
  channel: Channel;
  template: string;
  toUserId?: string;
  toAddress?: string;
  payload: Record<string, unknown>;
  /** `order_paid:<orderId>` — used as a unique key so re-emits no-op. */
  eventKey?: string;
}

export async function enqueueNotification(input: EnqueueInput): Promise<void> {
  // Resolve `toAddress` from the user record when only `toUserId` is provided.
  let toAddress = input.toAddress;
  if (!toAddress && input.toUserId) {
    const u = await User.findById(input.toUserId).select('email phone').lean();
    if (input.channel === 'email') toAddress = u?.email;
    if (input.channel === 'sms') toAddress = u?.phone;
  }

  try {
    await NotificationOutbox.create({
      tenantId: input.tenantId,
      channel: input.channel,
      template: input.template,
      payload: input.payload,
      toUserId: input.toUserId,
      toAddress,
      eventKey: input.eventKey,
      status: 'pending',
    });
  } catch (err) {
    // Duplicate eventKey — already enqueued. No-op.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose error shape
    if ((err as any)?.code === 11000) return;
    throw err;
  }
}

/**
 * Fan-out helper: enqueue email + SMS + push for the same event in one call.
 * The dispatcher decides which channels actually go out based on the user's
 * preferences + the row's `toAddress` being populated.
 */
export async function enqueueAllChannels(input: {
  tenantId: string;
  template: string;
  toUserId: string;
  payload: Record<string, unknown>;
  eventKey: string;
}): Promise<void> {
  await Promise.all([
    enqueueNotification({
      tenantId: input.tenantId,
      channel: 'email',
      template: input.template,
      toUserId: input.toUserId,
      payload: input.payload,
      eventKey: `${input.eventKey}:email`,
    }),
    enqueueNotification({
      tenantId: input.tenantId,
      channel: 'sms',
      template: input.template,
      toUserId: input.toUserId,
      payload: input.payload,
      eventKey: `${input.eventKey}:sms`,
    }),
    enqueueNotification({
      tenantId: input.tenantId,
      channel: 'push',
      template: input.template,
      toUserId: input.toUserId,
      payload: input.payload,
      eventKey: `${input.eventKey}:push`,
    }),
  ]);
}
