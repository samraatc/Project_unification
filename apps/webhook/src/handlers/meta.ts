import type { Request, RequestHandler, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PaymentEvent, SocialAccount } from '../../../api/src/db/models/index.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { facebookProvider } from '../../../api/src/services/social/providers/facebook.js';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ingestMessage } from '../../../api/src/services/social/inbox.service.js';

/**
 * Meta (Facebook + Instagram) webhook handler.
 *
 * Signature verification → idempotency check on `(provider, externalEventId)` →
 * fan out to inbox ingestion. Responds 200 before processing (the platform retries
 * on non-2xx; our work is durable via the BullMQ queue).
 */
export const metaWebhook: RequestHandler = async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer) ?? Buffer.alloc(0);
  if (!facebookProvider.verifyWebhookSignature({ rawBody, headers: req.headers })) {
    res.status(401).send('Invalid signature');
    return;
  }

  let payload: { object?: string; entry?: unknown[] };
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
  } catch {
    res.status(400).send('Invalid JSON');
    return;
  }

  const eventId = String(req.headers['x-event-id'] ?? `${Date.now()}-${rawBody.length}`);
  try {
    await PaymentEvent.create({
      provider: 'meta',
      externalEventId: eventId,
      type: payload.object ?? 'unknown',
      payload,
      receivedAt: new Date(),
    });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code === 11000) {
      // already processed
      res.status(200).send('OK');
      return;
    }
    throw err;
  }

  // ACK immediately, then process.
  res.status(200).send('OK');

  // Fan out entries to the inbox.
  for (const entry of payload.entry ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- platform payload shape
    const pageId = String((entry as any)?.id ?? '');
    if (!pageId) continue;
    // eslint-disable-next-line no-await-in-loop -- ordered processing
    const account = await SocialAccount.findOne({ platform: 'facebook', pageId }).select('tenantId externalAccountId');
    if (!account) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changes = ((entry as any)?.changes ?? []) as Array<{ field: string; value: Record<string, unknown> }>;
    for (const change of changes) {
      if (change.field === 'feed') {
        const v = change.value as { comment_id?: string; message?: string; from?: { name?: string } };
        if (v.comment_id) {
          // eslint-disable-next-line no-await-in-loop
          await ingestMessage({
            tenantId: String(account.tenantId),
            platform: 'facebook',
            externalAccountId: account.externalAccountId,
            externalMessageId: v.comment_id,
            kind: 'comment',
            authorHandle: v.from?.name,
            body: v.message ?? '',
          });
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messaging = ((entry as any)?.messaging ?? []) as Array<{
      sender?: { id?: string; name?: string };
      message?: { mid?: string; text?: string };
    }>;
    for (const m of messaging) {
      if (m.message?.mid) {
        // eslint-disable-next-line no-await-in-loop
        await ingestMessage({
          tenantId: String(account.tenantId),
          platform: 'facebook',
          externalAccountId: account.externalAccountId,
          externalMessageId: m.message.mid,
          kind: 'dm',
          authorHandle: m.sender?.name ?? m.sender?.id,
          body: m.message.text ?? '',
        });
      }
    }
  }
};
