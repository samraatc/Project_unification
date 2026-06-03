import type { Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PaymentEvent, SocialAccount } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { tiktokProvider } from '../../../api/src/services/social/providers/tiktok.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ingestMessage } from '../../../api/src/services/social/inbox.service.js';

export const tiktokWebhook: RequestHandler = async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
  if (!tiktokProvider.verifyWebhookSignature({ rawBody, headers: req.headers })) {
    res.status(401).send('Invalid signature');
    return;
  }

  let payload: {
    event_id?: string;
    event?: string;
    open_id?: string;
    data?: { comment_id?: string; text?: string; author?: { display_name?: string }; video_id?: string };
  };
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
  } catch {
    res.status(400).send('Invalid JSON');
    return;
  }

  const eventId = payload.event_id ?? `${Date.now()}-${rawBody.length}`;
  try {
    await PaymentEvent.create({
      provider: 'tiktok',
      externalEventId: eventId,
      type: payload.event ?? 'unknown',
      payload,
      receivedAt: new Date(),
    });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code === 11000) {
      res.status(200).send('OK');
      return;
    }
    throw err;
  }

  res.status(200).send('OK');

  const openId = payload.open_id;
  if (!openId) return;
  const account = await SocialAccount.findOne({ platform: 'tiktok', externalAccountId: openId }).select(
    'tenantId externalAccountId',
  );
  if (!account) return;
  if (payload.event === 'comment.create' && payload.data?.comment_id) {
    await ingestMessage({
      tenantId: String(account.tenantId),
      platform: 'tiktok',
      externalAccountId: account.externalAccountId,
      externalMessageId: payload.data.comment_id,
      kind: 'comment',
      authorHandle: payload.data.author?.display_name,
      body: payload.data.text ?? '',
    });
  }
};
