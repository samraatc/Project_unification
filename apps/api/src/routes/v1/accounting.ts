import { Router } from 'express';
import { z } from 'zod';

import {
  BankAccount,
  Budget,
  ChartOfAccounts,
  Invoice,
  JournalEntry,
  Subscription,
} from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth, requireEntitlement, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  postJournalEntry,
  reverseJournalEntry,
  seedCoaTemplate,
} from '../../services/accounting/ledger.service.js';
import {
  closePeriod,
  createPeriod,
  lockPeriod,
  reopenPeriod,
} from '../../services/accounting/period.service.js';
import {
  balanceSheet,
  cashFlow,
  generalLedger,
  profitAndLoss,
  subLedger,
  trialBalance,
} from '../../services/accounting/reports.service.js';
import {
  computeTaxLines,
  generateInvoice,
  gstr1,
  gstr3b,
  lookupInvoiceEInvoice,
  vat200,
} from '../../services/accounting/tax.service.js';
import {
  autoMatch,
  importTransactions,
  listUnmatched,
  manualMatch,
} from '../../services/accounting/bank.service.js';
import { buildAuditPack } from '../../services/accounting/auditPack.service.js';
import { verifyChain } from '../../services/accounting/auditChain.service.js';
import { upsertFxRate } from '../../services/accounting/fx.service.js';

export const accountingRouter: Router = Router();

/* -------------------------------------------------------------------------- */
/* Chart of Accounts                                                          */
/* -------------------------------------------------------------------------- */

accountingRouter.get(
  '/chart-of-accounts',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.ledger'),
  async (req, res, next) => {
    try {
      const docs = await ChartOfAccounts.find({ tenantId: req.user!.tenantId, isActive: true })
        .sort({ code: 1 })
        .lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

const SeedCoaBody = z.object({ template: z.enum(['retail', 'services', 'manufacturing']) });

accountingRouter.post(
  '/chart-of-accounts/seed',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.ledger'),
  validate(SeedCoaBody),
  async (req, res, next) => {
    try {
      const result = await seedCoaTemplate({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        template: req.body.template,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

const CreateAccountBody = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(1).max(200),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normalSide: z.enum(['dr', 'cr']),
  parentId: z.string().optional(),
  currency: z.string().length(3).optional(),
});

accountingRouter.post(
  '/chart-of-accounts',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.ledger'),
  validate(CreateAccountBody),
  async (req, res, next) => {
    try {
      const doc = await ChartOfAccounts.create({
        tenantId: req.user!.tenantId,
        ...req.body,
        parent: req.body.parentId,
        isSystem: false,
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Journal entries                                                            */
/* -------------------------------------------------------------------------- */

const ListJEQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['order', 'refund', 'payout', 'stock_writeoff', 'po_receive', 'manual', 'recurring']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

accountingRouter.get(
  '/journal-entries',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.ledger'),
  validate(ListJEQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof ListJEQuery>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose typed query
      const filter: any = { tenantId: req.user!.tenantId };
      if (q.source) filter.source = q.source;
      if (q.from || q.to) {
        filter.postedAt = {};
        if (q.from) filter.postedAt.$gte = new Date(q.from);
        if (q.to) filter.postedAt.$lte = new Date(q.to);
      }
      if (q.cursor) filter._id = { $lt: q.cursor };
      const docs = await JournalEntry.find(filter).sort({ _id: -1 }).limit(q.limit + 1).lean();
      const hasMore = docs.length > q.limit;
      const items = hasMore ? docs.slice(0, q.limit) : docs;
      res.json({
        data: items,
        meta: { nextCursor: hasMore ? String(items[items.length - 1]?._id) : null },
      });
    } catch (err) {
      next(err);
    }
  },
);

const ManualJEBody = z.object({
  description: z.string().min(1).max(2000),
  reference: z.string().max(200).optional(),
  lines: z
    .array(
      z.object({
        accountCode: z.string().min(1),
        side: z.enum(['dr', 'cr']),
        amountMinor: z.number().int().positive(),
        currency: z.string().length(3).optional(),
        memo: z.string().max(500).optional(),
      }),
    )
    .min(2),
});

accountingRouter.post(
  '/journal-entries',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.journals'),
  validate(ManualJEBody),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof ManualJEBody>;
      const entry = await postJournalEntry({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        source: 'manual',
        description: body.description,
        reference: body.reference,
        lines: body.lines,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.post(
  '/journal-entries/:id/reverse',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.journals'),
  async (req, res, next) => {
    try {
      const reversal = await reverseJournalEntry({
        entryId: req.params.id,
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.json(reversal);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

const RangeQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  asOf: z.string().datetime().optional(),
});

function parseRange(q: z.infer<typeof RangeQuery>, tenantId: string) {
  return {
    tenantId,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    asOf: q.asOf ? new Date(q.asOf) : undefined,
  };
}

accountingRouter.get(
  '/reports/pl',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.reports.pl'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      res.json(await profitAndLoss(parseRange(req.query as z.infer<typeof RangeQuery>, req.user!.tenantId)));
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/reports/balance-sheet',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.reports.balance_sheet'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      res.json(await balanceSheet(parseRange(req.query as z.infer<typeof RangeQuery>, req.user!.tenantId)));
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/reports/cash-flow',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.reports.cash_flow'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      res.json(await cashFlow(parseRange(req.query as z.infer<typeof RangeQuery>, req.user!.tenantId)));
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/reports/trial-balance',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.reports.trial_balance'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      res.json(await trialBalance(parseRange(req.query as z.infer<typeof RangeQuery>, req.user!.tenantId)));
    } catch (err) {
      next(err);
    }
  },
);

const GLQuery = RangeQuery.extend({ accountId: z.string().min(1) });

accountingRouter.get(
  '/reports/general-ledger',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.reports.general_ledger'),
  validate(GLQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof GLQuery>;
      res.json(await generalLedger({ ...parseRange(q, req.user!.tenantId), accountId: q.accountId }));
    } catch (err) {
      next(err);
    }
  },
);

const SubLedgerQuery = RangeQuery.extend({
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
});

accountingRouter.get(
  '/reports/sub-ledger',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.reports.sub_ledger'),
  validate(SubLedgerQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof SubLedgerQuery>;
      res.json(await subLedger({ ...parseRange(q, req.user!.tenantId), accountType: q.type }));
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Periods                                                                    */
/* -------------------------------------------------------------------------- */

const CreatePeriodBody = z.object({
  type: z.enum(['month', 'quarter', 'year']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

accountingRouter.post(
  '/periods',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.period_close'),
  validate(CreatePeriodBody),
  async (req, res, next) => {
    try {
      const doc = await createPeriod({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        type: req.body.type,
        startsAt: new Date(req.body.startsAt),
        endsAt: new Date(req.body.endsAt),
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.post(
  '/periods/:id/close',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.period_close'),
  async (req, res, next) => {
    try {
      const doc = await closePeriod({ periodId: req.params.id, tenantId: req.user!.tenantId, actorId: req.user!.sub });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.post(
  '/periods/:id/reopen',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.period_close'),
  async (req, res, next) => {
    try {
      if (!req.user!.roles.includes('super_admin')) {
        throw new HttpError(403, 'FORBIDDEN', 'Only Super Admin can reopen a period.');
      }
      const doc = await reopenPeriod({ periodId: req.params.id, tenantId: req.user!.tenantId, actorId: req.user!.sub });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.post(
  '/periods/:id/lock',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.period_close'),
  async (req, res, next) => {
    try {
      const doc = await lockPeriod({ periodId: req.params.id, tenantId: req.user!.tenantId, actorId: req.user!.sub });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Tax                                                                        */
/* -------------------------------------------------------------------------- */

accountingRouter.get(
  '/tax/returns/vat200',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.tax.vat200'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof RangeQuery>;
      res.json(
        await vat200({
          tenantId: req.user!.tenantId,
          from: q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000),
          to: q.to ? new Date(q.to) : new Date(),
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/tax/returns/gstr1',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.tax.gstr1'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof RangeQuery>;
      res.json(
        await gstr1({
          tenantId: req.user!.tenantId,
          from: q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000),
          to: q.to ? new Date(q.to) : new Date(),
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/tax/returns/gstr3b',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.tax.gstr3b'),
  validate(RangeQuery, 'query'),
  async (req, res, next) => {
    try {
      const q = req.query as unknown as z.infer<typeof RangeQuery>;
      res.json(
        await gstr3b({
          tenantId: req.user!.tenantId,
          from: q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000),
          to: q.to ? new Date(q.to) : new Date(),
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/invoices/:id/e-invoice.json',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.tax.ird_einvoice'),
  async (req, res, next) => {
    try {
      res.json(await lookupInvoiceEInvoice(req.user!.tenantId, req.params.id));
    } catch (err) {
      next(err);
    }
  },
);

const InvoiceBody = z.object({
  orderId: z.string().min(1),
  number: z.string().min(1).max(80),
  currency: z.string().length(3),
  lines: z
    .array(
      z.object({
        sku: z.string(),
        description: z.string(),
        qty: z.number().int().positive(),
        unitPrice: z.number().int().nonnegative(),
        taxClass: z.string().optional(),
      }),
    )
    .min(1),
});

accountingRouter.post(
  '/invoices',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.tax.ird_einvoice'),
  validate(InvoiceBody),
  async (req, res, next) => {
    try {
      const computed = await computeTaxLines(
        { tenantId: req.user!.tenantId },
        (req.body as z.infer<typeof InvoiceBody>).lines,
      );
      const invoice = await generateInvoice({
        tenantId: req.user!.tenantId,
        orderId: req.body.orderId,
        number: req.body.number,
        currency: req.body.currency,
        lines: computed,
        actorId: req.user!.sub,
      });
      res.status(201).json(invoice);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/invoices',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.tax.ird_einvoice'),
  async (req, res, next) => {
    try {
      const docs = await Invoice.find({ tenantId: req.user!.tenantId })
        .sort({ issuedAt: -1 })
        .limit(200)
        .lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Bank                                                                       */
/* -------------------------------------------------------------------------- */

const CreateBankBody = z.object({
  name: z.string().min(1).max(120),
  institutionName: z.string().max(120).optional(),
  accountNumberMasked: z.string().max(40).optional(),
  currency: z.string().length(3).default('USD'),
  ledgerAccountCode: z.string().min(2),
  openingBalanceMinor: z.number().int().default(0),
});

accountingRouter.post(
  '/bank/accounts',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.bank_reconciliation'),
  validate(CreateBankBody),
  async (req, res, next) => {
    try {
      const ledger = await ChartOfAccounts.findOne({ tenantId: req.user!.tenantId, code: req.body.ledgerAccountCode }).select('_id');
      if (!ledger) throw new HttpError(404, 'LEDGER_ACCOUNT_NOT_FOUND', `No CoA account with code ${req.body.ledgerAccountCode}.`);
      const doc = await BankAccount.create({
        tenantId: req.user!.tenantId,
        name: req.body.name,
        institutionName: req.body.institutionName,
        accountNumberMasked: req.body.accountNumberMasked,
        currency: req.body.currency,
        ledgerAccountId: ledger._id,
        openingBalanceMinor: req.body.openingBalanceMinor,
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/bank/accounts',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.bank_reconciliation'),
  async (req, res, next) => {
    try {
      const docs = await BankAccount.find({ tenantId: req.user!.tenantId, isActive: true }).lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

const ImportTxnsBody = z.object({
  bankAccountId: z.string().min(1),
  rows: z
    .array(
      z.object({
        date: z.string().datetime(),
        amountMinor: z.number().int(),
        direction: z.enum(['credit', 'debit']),
        reference: z.string().max(200).optional(),
        description: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

accountingRouter.post(
  '/bank/transactions/import',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.bank_reconciliation'),
  validate(ImportTxnsBody),
  async (req, res, next) => {
    try {
      const result = await importTransactions({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        bankAccountId: req.body.bankAccountId,
        rows: req.body.rows,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/bank/transactions',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.bank_reconciliation'),
  async (req, res, next) => {
    try {
      const rows = await listUnmatched(req.user!.tenantId, req.query.bankAccountId as string | undefined);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.post(
  '/bank/auto-match',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.bank_reconciliation'),
  async (req, res, next) => {
    try {
      const bankAccountId = String(req.body.bankAccountId ?? '');
      if (!bankAccountId) throw new HttpError(400, 'BANK_ACCOUNT_REQUIRED', 'bankAccountId required.');
      const result = await autoMatch({ tenantId: req.user!.tenantId, bankAccountId, actorId: req.user!.sub });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

const MatchBody = z.object({ journalEntryId: z.string().min(1) });

accountingRouter.post(
  '/bank/transactions/:id/match',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.bank_reconciliation'),
  validate(MatchBody),
  async (req, res, next) => {
    try {
      const t = await manualMatch({
        tenantId: req.user!.tenantId,
        transactionId: req.params.id,
        journalEntryId: req.body.journalEntryId,
        actorId: req.user!.sub,
      });
      res.json(t);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Budgets                                                                    */
/* -------------------------------------------------------------------------- */

const BudgetBody = z.object({
  year: z.number().int().min(2024).max(2100),
  costCentre: z.string().max(120).default('default'),
  accountCode: z.string().min(2),
  monthly: z.array(z.number().int()).length(12),
});

accountingRouter.post(
  '/budgets',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.budgeting'),
  validate(BudgetBody),
  async (req, res, next) => {
    try {
      const acct = await ChartOfAccounts.findOne({ tenantId: req.user!.tenantId, code: req.body.accountCode }).select('_id');
      if (!acct) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'No CoA account for the given code.');
      const doc = await Budget.findOneAndUpdate(
        { tenantId: req.user!.tenantId, year: req.body.year, costCentre: req.body.costCentre, accountId: acct._id },
        { $set: { monthly: req.body.monthly } },
        { upsert: true, new: true },
      );
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/budgets',
  requireAuth,
  requirePermission('accounting.read'),
  requireEntitlement('accounting.budgeting'),
  async (req, res, next) => {
    try {
      const docs = await Budget.find({ tenantId: req.user!.tenantId }).lean();
      res.json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* FX rates                                                                   */
/* -------------------------------------------------------------------------- */

const FxBody = z.object({
  base: z.string().length(3),
  quote: z.string().length(3),
  rate: z.number().positive(),
  asOf: z.string().datetime().optional(),
});

accountingRouter.post(
  '/fx-rates',
  requireAuth,
  requirePermission('accounting.write'),
  requireEntitlement('accounting.multi_currency'),
  validate(FxBody),
  async (req, res, next) => {
    try {
      const doc = await upsertFxRate({
        tenantId: req.user!.tenantId,
        base: req.body.base,
        quote: req.body.quote,
        rate: req.body.rate,
        asOf: req.body.asOf ? new Date(req.body.asOf) : undefined,
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Audit pack + chain verification                                            */
/* -------------------------------------------------------------------------- */

const AuditPackBody = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

accountingRouter.post(
  '/audit-pack/export',
  requireAuth,
  requirePermission('accounting.export'),
  requireEntitlement('accounting.audit_pack'),
  validate(AuditPackBody),
  async (req, res, next) => {
    try {
      const manifest = await buildAuditPack({
        tenantId: req.user!.tenantId,
        actorId: req.user!.sub,
        from: new Date(req.body.from),
        to: new Date(req.body.to),
        ip: req.ip,
        ua: req.headers['user-agent'],
      });
      res.status(201).json(manifest);
    } catch (err) {
      next(err);
    }
  },
);

accountingRouter.get(
  '/audit-pack/chain/verify',
  requireAuth,
  requirePermission('accounting.export'),
  requireEntitlement('accounting.audit'),
  async (req, res, next) => {
    try {
      res.json(await verifyChain(req.user!.tenantId));
    } catch (err) {
      next(err);
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Subscription summary surfaced under /accounting for the portal             */
/* -------------------------------------------------------------------------- */

accountingRouter.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ tenantId: req.user!.tenantId }).lean();
    res.json(sub ?? { status: 'none', entitlements: [] });
  } catch (err) {
    next(err);
  }
});
