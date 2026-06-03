import { Types } from 'mongoose';

import { InboxMessage, SocialAccount, type InboxMessageDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import type { Platform } from './providers/index.js';

/** Default SLA — 30 minutes from receipt to first reply. Tunable per tenant later. */
const DEFAULT_SLA_MS = 30 * 60_000;

export interface IngestMessageInput {
  tenantId: string;
  platform: Platform;
  externalAccountId: string;
  externalMessageId: string;
  threadId?: string;
  kind: 'comment' | 'dm' | 'mention';
  authorHandle?: string;
  authorAvatarUrl?: string;
  body: string;
  mediaUrls?: string[];
  receivedAt?: Date;
}

/** Idempotent inbox ingestion — webhook handlers call this. */
export async function ingestMessage(input: IngestMessageInput): Promise<InboxMessageDoc | null> {
  const account = await SocialAccount.findOne({
    tenantId: input.tenantId,
    platform: input.platform,
    externalAccountId: input.externalAccountId,
  })
    .select('_id')
    .lean();
  if (!account) return null; // event for an account we don't manage

  const received = input.receivedAt ?? new Date();
  try {
    const doc = await InboxMessage.create({
      tenantId: input.tenantId,
      socialAccountId: account._id,
      platform: input.platform,
      threadId: input.threadId,
      externalMessageId: input.externalMessageId,
      kind: input.kind,
      authorHandle: input.authorHandle,
      authorAvatarUrl: input.authorAvatarUrl,
      body: input.body,
      mediaUrls: input.mediaUrls ?? [],
      receivedAt: received,
      slaDueAt: new Date(received.getTime() + DEFAULT_SLA_MS),
      status: 'new',
    });
    return doc;
  } catch (err) {
    // Duplicate key on (tenantId, platform, externalMessageId) — already ingested.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose error shape
    if ((err as any)?.code === 11000) return null;
    throw err;
  }
}

export interface AssignInput {
  messageId: string;
  tenantId: string;
  actorId: string;
  assigneeId: string;
  ip?: string;
  ua?: string;
}

export async function assignMessage(input: AssignInput): Promise<InboxMessageDoc> {
  const msg = await InboxMessage.findOne({ _id: input.messageId, tenantId: input.tenantId });
  if (!msg) throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'Inbox message not found.');
  msg.assignedTo = new Types.ObjectId(input.assigneeId) as unknown as InboxMessageDoc['assignedTo'];
  if (msg.status === 'new') msg.status = 'open';
  await msg.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.inbox_assigned',
    entity: 'InboxMessage',
    entityId: msg._id,
    afterJson: { assigneeId: input.assigneeId },
    ip: input.ip,
    ua: input.ua,
  });
  return msg;
}

export interface ReplyInput {
  messageId: string;
  tenantId: string;
  actorId: string;
  body: string;
  ip?: string;
  ua?: string;
}

export async function replyToMessage(input: ReplyInput): Promise<InboxMessageDoc> {
  const original = await InboxMessage.findOne({ _id: input.messageId, tenantId: input.tenantId });
  if (!original) throw new HttpError(404, 'MESSAGE_NOT_FOUND', 'Inbox message not found.');
  // Phase 2.4 records the outbound reply locally. The platform-side send (comment
  // reply / DM) lands when the worker integration is wired in Phase 2.5.
  const reply = await InboxMessage.create({
    tenantId: original.tenantId,
    socialAccountId: original.socialAccountId,
    platform: original.platform,
    threadId: original.threadId,
    externalMessageId: `local-${Date.now()}-${input.actorId}`,
    kind: original.kind,
    body: input.body,
    direction: 'outbound',
    receivedAt: new Date(),
    status: 'responded',
  });

  original.status = 'responded';
  original.respondedAt = new Date();
  if (original.slaDueAt && original.slaDueAt < original.respondedAt) {
    original.slaBreachedAt = original.respondedAt;
  }
  await original.save();

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'social.inbox_replied',
    entity: 'InboxMessage',
    entityId: original._id,
    ip: input.ip,
    ua: input.ua,
  });
  return reply;
}
