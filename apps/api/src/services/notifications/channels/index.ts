import { sendgridEmail } from './sendgrid.email.js';
import { smsChannel } from './sms.js';
import { fcmPush } from './fcm.push.js';
import type { ChannelKind, NotificationChannel } from './types.js';

const REGISTRY: Record<ChannelKind, NotificationChannel> = {
  email: sendgridEmail,
  sms: smsChannel,
  push: fcmPush,
};

export function channelFor(kind: ChannelKind): NotificationChannel {
  return REGISTRY[kind];
}

export type { ChannelKind, NotificationChannel } from './types.js';
