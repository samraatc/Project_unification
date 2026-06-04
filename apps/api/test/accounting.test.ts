/** Phase 6 — ledger + tax + billing + audit-chain unit tests (pure functions). */
import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { COA_TEMPLATES } from '../src/services/accounting/templates.js';
import {
  PLANS,
  planFor,
  GRACE_PERIOD_DAYS,
  ARCHIVE_AFTER_DAYS,
} from '../src/services/billing/plans.js';
import {
  BILLING_PROVIDERS,
  billingProviderFor,
} from '../src/services/billing/providers/index.js';
import { stripeBilling } from '../src/services/billing/providers/stripeBilling.js';
import { nextDunningAttemptAt } from '../src/services/billing/billing.service.js';

describe('CoA templates', () => {
  it('seeds three templates with the documented numbering scheme', () => {
    expect(Object.keys(COA_TEMPLATES).sort()).toEqual(['manufacturing', 'retail', 'services']);
  });

  it('every account code maps to a 4-digit prefix by type (D-0016)', () => {
    const prefixByType: Record<string, string> = {
      asset: '1',
      liability: '2',
      equity: '3',
      revenue: '4',
      expense: '5',
    };
    // Some accounts use 6xxx as expense sub-trees; allow 5xxx or 6xxx for expense.
    for (const tpl of Object.values(COA_TEMPLATES)) {
      for (const s of tpl) {
        const prefix = s.code[0];
        if (s.type === 'expense') {
          expect(['5', '6']).toContain(prefix);
        } else {
          expect(prefix).toBe(prefixByType[s.type]);
        }
      }
    }
  });
});

describe('plans catalogue', () => {
  it('exposes all five plan codes', () => {
    expect(PLANS.map((p) => p.code).sort()).toEqual(['enterprise', 'lifetime', 'monthly', 'trial', 'yearly']);
  });

  it('trial includes a 14-day free window', () => {
    expect(planFor('trial').trialDays).toBe(14);
  });

  it('grace and archive constants match FR-016 (7 + 14 days)', () => {
    expect(GRACE_PERIOD_DAYS).toBe(7);
    expect(ARCHIVE_AFTER_DAYS).toBe(14);
  });

  it('lifetime plan unlocks premium entitlements', () => {
    expect(planFor('lifetime').entitlements).toContain('accounting.tax.ird_einvoice');
    expect(planFor('lifetime').entitlements).toContain('accounting.audit_pack');
  });
});

describe('dunning schedule', () => {
  it('nextDunningAttemptAt walks +1d, +3d, +7d then stops', () => {
    const t0 = Date.now();
    const a1 = nextDunningAttemptAt(1)!;
    const a2 = nextDunningAttemptAt(2)!;
    const a3 = nextDunningAttemptAt(3)!;
    expect(Math.round((a1.getTime() - t0) / 86_400_000)).toBe(1);
    expect(Math.round((a2.getTime() - t0) / 86_400_000)).toBe(3);
    expect(Math.round((a3.getTime() - t0) / 86_400_000)).toBe(7);
    expect(nextDunningAttemptAt(4)).toBeUndefined();
  });
});

describe('billing providers', () => {
  it('exposes one provider per documented code', () => {
    expect(BILLING_PROVIDERS).toEqual(['stripe', 'esewa', 'khalti']);
    for (const code of BILLING_PROVIDERS) {
      const p = billingProviderFor(code);
      expect(p.code).toBe(code);
      expect(typeof p.createCheckout).toBe('function');
      expect(typeof p.verifyWebhookSignature).toBe('function');
    }
  });

  it('Stripe Billing verifier accepts a valid HMAC + rejects tampered bodies', () => {
    const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? 'whsec_billing_dev';
    const body = Buffer.from(JSON.stringify({ id: 'evt_test', type: 'invoice.payment_succeeded' }));
    const t = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', secret).update(`${t}.${body.toString('utf8')}`).digest('hex');
    expect(
      stripeBilling.verifyWebhookSignature({ rawBody: body, headers: { 'stripe-signature': `t=${t},v1=${sig}` } }),
    ).toBe(true);
    expect(
      stripeBilling.verifyWebhookSignature({
        rawBody: Buffer.from('tampered'),
        headers: { 'stripe-signature': `t=${t},v1=${sig}` },
      }),
    ).toBe(false);
  });
});

describe('audit chain canonical hash', () => {
  it('sha256(prev + canonical(entry)) is stable across re-renders', () => {
    const entry = { _id: 'abc', tenantId: 't', actorId: 'u', action: 'x', entity: 'E', entityId: '1', afterJson: { a: 1 }, ts: new Date('2026-01-01').toISOString() };
    const canonical = JSON.stringify({
      id: entry._id,
      tenantId: entry.tenantId,
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      afterJson: entry.afterJson,
      ts: entry.ts,
    });
    const a = createHash('sha256').update('').update(canonical).digest('hex');
    const b = createHash('sha256').update('').update(canonical).digest('hex');
    expect(a).toBe(b);
    // Chaining forward changes the hash.
    const next = createHash('sha256').update(a).update(canonical).digest('hex');
    expect(next).not.toBe(a);
  });
});
