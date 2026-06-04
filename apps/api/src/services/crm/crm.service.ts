import {
  CommunicationLog,
  CustomerTag,
  Order,
  User,
  type UserDoc,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';

/**
 * CRM Lite — PRD §3.2.
 *
 * Surfaces customer profile, tags + segments, communication log, lifetime spend.
 * Segments in v1 are tag-derived (e.g. `vip` = users with the `vip` tag plus
 * orders ≥ $500 lifetime). The full segment-builder UI lands with Phase 5
 * analytics.
 */

export async function getCustomerProfile(tenantId: string, userId: string) {
  const [user, tags, comms, orderStats] = await Promise.all([
    User.findOne({ _id: userId, tenantId })
      .select('-passwordHash -twoFA.secretCipher -twoFA.backupCodesHash -oauth.accessTokenCipher -oauth.refreshTokenCipher')
      .lean(),
    CustomerTag.find({ tenantId, userId }).lean(),
    CommunicationLog.find({ tenantId, userId }).sort({ createdAt: -1 }).limit(50).lean(),
    Order.aggregate([
      { $match: { tenantId: typeof tenantId === 'string' ? null : tenantId, userId } },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          totalSpend: { $sum: '$totals.total' },
          lastOrderAt: { $max: '$createdAt' },
        },
      },
    ]),
  ]);
  if (!user) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');

  const stats = orderStats[0] ?? { orderCount: 0, totalSpend: 0 };
  return {
    user,
    tags: tags.map((t) => t.tag),
    segments: computeSegments({ tags: tags.map((t) => t.tag), totalSpend: stats.totalSpend }),
    stats,
    communicationLog: comms,
  };
}

function computeSegments(input: { tags: string[]; totalSpend: number }): string[] {
  const segs: string[] = [];
  if (input.tags.includes('vip') || input.totalSpend >= 50_000_00) segs.push('vip');
  if (input.totalSpend === 0) segs.push('new');
  else if (input.totalSpend >= 10_000_00) segs.push('repeat');
  return segs;
}

export interface AddTagInput {
  tenantId: string;
  userId: string;
  tag: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function addTag(input: AddTagInput) {
  await CustomerTag.updateOne(
    { tenantId: input.tenantId, userId: input.userId, tag: input.tag.toLowerCase() },
    { $setOnInsert: { assignedBy: input.actorId } },
    { upsert: true },
  );
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'crm.tag_added',
    entity: 'User',
    entityId: input.userId,
    afterJson: { tag: input.tag },
    ip: input.ip,
    ua: input.ua,
  });
}

export async function removeTag(input: AddTagInput) {
  await CustomerTag.deleteOne({ tenantId: input.tenantId, userId: input.userId, tag: input.tag.toLowerCase() });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'crm.tag_removed',
    entity: 'User',
    entityId: input.userId,
    afterJson: { tag: input.tag },
    ip: input.ip,
    ua: input.ua,
  });
}

export interface AddNoteInput {
  tenantId: string;
  userId: string;
  actorId: string;
  body: string;
  subject?: string;
  ip?: string;
  ua?: string;
}

export async function addCustomerNote(input: AddNoteInput) {
  const log = await CommunicationLog.create({
    tenantId: input.tenantId,
    userId: input.userId,
    direction: 'outbound',
    channel: 'note',
    subject: input.subject,
    body: input.body,
    authorId: input.actorId,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'crm.note_added',
    entity: 'User',
    entityId: input.userId,
    ip: input.ip,
    ua: input.ua,
  });
  return log;
}

/* -------------------------------------------------------------------------- */
/* List + search                                                              */
/* -------------------------------------------------------------------------- */

export interface ListCustomersInput {
  tenantId: string;
  q?: string;
  segment?: string;
  cursor?: string;
  limit: number;
}

export async function listCustomers(input: ListCustomersInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
  const filter: any = { tenantId: input.tenantId, status: 'active' };
  if (input.q) {
    const re = new RegExp(input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ email: re }, { phone: re }, { 'profile.firstName': re }, { 'profile.lastName': re }];
  }
  if (input.cursor) filter._id = { $lt: input.cursor };
  const docs = (await User.find(filter)
    .sort({ _id: -1 })
    .limit(input.limit + 1)
    .select('email phone profile lastLoginAt createdAt')
    .lean()) as Array<Pick<UserDoc, '_id' | 'email' | 'phone' | 'profile' | 'lastLoginAt' | 'createdAt'>>;
  const hasMore = docs.length > input.limit;
  const items = hasMore ? docs.slice(0, input.limit) : docs;
  return {
    data: items,
    nextCursor: hasMore ? String(items[items.length - 1]?._id) : null,
  };
}
