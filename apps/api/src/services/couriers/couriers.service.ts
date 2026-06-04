import { Courier, Order, type OrderDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';
import { decryptField, encryptField } from '../crypto.service.js';
import { courierProvider, type CourierCode } from './providers/index.js';

/**
 * Courier registry + tracking-link generation + scan-event ingestion.
 */

export interface RegisterCourierInput {
  tenantId: string;
  actorId: string;
  code: CourierCode;
  name: string;
  webhookSecret: string;
  trackingUrlTemplate?: string;
  contactPhone?: string;
  contactEmail?: string;
  ip?: string;
  ua?: string;
}

export async function registerCourier(input: RegisterCourierInput) {
  const provider = courierProvider(input.code);
  const doc = await Courier.findOneAndUpdate(
    { tenantId: input.tenantId, code: input.code },
    {
      $set: {
        tenantId: input.tenantId,
        code: input.code,
        name: input.name,
        trackingUrlTemplate: input.trackingUrlTemplate ?? provider.trackingUrl('{TRACKING}').replace('{TRACKING}', '{TRACKING}'),
        webhookSecretCipher: encryptField(input.webhookSecret),
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'courier.registered',
    entity: 'Courier',
    entityId: doc._id,
    afterJson: { code: input.code, name: input.name },
    ip: input.ip,
    ua: input.ua,
  });
  return doc;
}

export async function rotateWebhookSecret(input: { tenantId: string; actorId: string; code: CourierCode; newSecret: string }) {
  await Courier.updateOne(
    { tenantId: input.tenantId, code: input.code },
    { $set: { webhookSecretCipher: encryptField(input.newSecret) } },
  );
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'courier.secret_rotated',
    entity: 'Courier',
    afterJson: { code: input.code },
  });
}

export async function getCourierSecret(tenantId: string, code: CourierCode): Promise<string | null> {
  const courier = await Courier.findOne({ tenantId, code, isActive: true }).select('+webhookSecretCipher').lean();
  if (!courier?.webhookSecretCipher) return null;
  return decryptField(courier.webhookSecretCipher);
}

export interface AssignCourierInput {
  orderId: string;
  tenantId: string;
  actorId: string;
  courierCode: CourierCode;
  trackingNumber: string;
  ip?: string;
  ua?: string;
}

export async function assignCourier(input: AssignCourierInput): Promise<OrderDoc> {
  const order = await Order.findOne({ _id: input.orderId, tenantId: input.tenantId });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  order.shipping = {
    ...(order.shipping ?? {}),
    courier: input.courierCode,
    trackingNumber: input.trackingNumber,
  } as OrderDoc['shipping'];
  await order.save();
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'courier.assigned',
    entity: 'Order',
    entityId: order._id,
    afterJson: { courier: input.courierCode, trackingNumber: input.trackingNumber },
    ip: input.ip,
    ua: input.ua,
  });
  return order;
}

export interface IngestScanEventsInput {
  tenantId: string;
  courierCode: CourierCode;
  events: Array<{ status: string; location?: string; ts: Date; trackingNumber: string; delivered?: boolean }>;
}

export async function ingestScanEvents(input: IngestScanEventsInput): Promise<void> {
  for (const e of input.events) {
    if (!e.trackingNumber) continue;
    // eslint-disable-next-line no-await-in-loop -- per-event update
    await Order.updateOne(
      { tenantId: input.tenantId, 'shipping.trackingNumber': e.trackingNumber },
      {
        $push: { 'shipping.scanEvents': { status: e.status, location: e.location, ts: e.ts } },
        ...(e.delivered ? { $set: { status: 'delivered', 'shipping.deliveredAt': e.ts } } : {}),
      },
    );
  }
}
