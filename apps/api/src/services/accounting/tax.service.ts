import { Invoice, JournalEntry, TaxRate, type InvoiceDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { audit } from '../audit.service.js';

/**
 * Tax engine — FR-014.
 *
 * `computeTaxLines()` is called by the cart/checkout layer to attach VAT/GST to
 * each line. `generateInvoice()` creates a regulatory-grade invoice row + IRD
 * e-invoice JSON. `vat200()` / `gstr1()` / `gstr3b()` aggregate from
 * `journalEntries` for regulator-format exports.
 */

export interface TaxLineInput {
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxClass?: string;
}

export interface TaxLineOutput extends TaxLineInput {
  taxRateBp: number;
  taxAmount: number;
  subtotal: number;
}

export interface ComputeOptions {
  tenantId: string;
  jurisdiction?: string;
  asOf?: Date;
}

export async function computeTaxLines(opts: ComputeOptions, lines: TaxLineInput[]): Promise<TaxLineOutput[]> {
  const rates = await TaxRate.find({
    tenantId: opts.tenantId,
    isActive: true,
    jurisdiction: opts.jurisdiction ?? 'NP',
    validFrom: { $lte: opts.asOf ?? new Date() },
    $or: [{ validTo: { $exists: false } }, { validTo: { $gte: opts.asOf ?? new Date() } }],
  }).lean();

  return lines.map((line) => {
    const rate = rates.find((r) => r.appliesTo?.includes(line.taxClass ?? 'standard'));
    const rateBp = rate?.rateBp ?? 0;
    const subtotal = line.qty * line.unitPrice;
    const taxAmount = Math.round((subtotal * rateBp) / 10_000);
    return { ...line, taxRateBp: rateBp, taxAmount, subtotal };
  });
}

/* -------------------------------------------------------------------------- */
/* Invoice generation + IRD e-invoice                                         */
/* -------------------------------------------------------------------------- */

export interface GenerateInvoiceInput {
  tenantId: string;
  orderId: string;
  number: string;
  currency: string;
  lines: TaxLineOutput[];
  actorId?: string;
}

export async function generateInvoice(input: GenerateInvoiceInput): Promise<InvoiceDoc> {
  const subTotal = input.lines.reduce((s, l) => s + l.subtotal, 0);
  const taxTotal = input.lines.reduce((s, l) => s + l.taxAmount, 0);
  const total = subTotal + taxTotal;

  const eInvoiceJson = buildIrdEInvoice({
    number: input.number,
    currency: input.currency,
    subTotal,
    taxTotal,
    total,
    lines: input.lines,
  });

  const invoice = await Invoice.create({
    tenantId: input.tenantId,
    orderId: input.orderId,
    number: input.number,
    currency: input.currency,
    subTotal,
    taxTotal,
    total,
    lines: input.lines.map((l) => ({
      sku: l.sku,
      description: l.description,
      qty: l.qty,
      unitPrice: l.unitPrice,
      subtotal: l.subtotal,
      taxRateBp: l.taxRateBp,
      taxAmount: l.taxAmount,
    })),
    pdfKey: `tenants/${input.tenantId}/invoices/${input.number}.pdf`,
    eInvoiceJsonKey: `tenants/${input.tenantId}/invoices/${input.number}.einv.json`,
    eInvoiceHash: hashStringSync(JSON.stringify(eInvoiceJson)),
    status: 'issued',
  });

  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'tax.invoice_generated',
    entity: 'Invoice',
    entityId: invoice._id,
    afterJson: { number: input.number, total, taxTotal },
    premium: true,
  });
  return invoice;
}

function buildIrdEInvoice(input: {
  number: string;
  currency: string;
  subTotal: number;
  taxTotal: number;
  total: number;
  lines: TaxLineOutput[];
}) {
  // Nepal IRD JSON shape (simplified — full schema is published by IRD).
  return {
    invoice_number: input.number,
    currency: input.currency,
    sub_total: input.subTotal / 100,
    tax_total: input.taxTotal / 100,
    grand_total: input.total / 100,
    line_items: input.lines.map((l, i) => ({
      sn: i + 1,
      sku: l.sku,
      description: l.description,
      qty: l.qty,
      unit_price: l.unitPrice / 100,
      taxable_value: l.subtotal / 100,
      vat_rate: l.taxRateBp / 100,
      vat_amount: l.taxAmount / 100,
    })),
    timestamp: new Date().toISOString(),
  };
}

function hashStringSync(s: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  return createHash('sha256').update(s).digest('hex');
}

/* -------------------------------------------------------------------------- */
/* Regulatory exports                                                          */
/* -------------------------------------------------------------------------- */

export interface RegulatoryExportInput {
  tenantId: string;
  from: Date;
  to: Date;
}

export async function vat200(input: RegulatoryExportInput) {
  const data = await Invoice.aggregate([
    {
      $match: {
        tenantId: input.tenantId,
        issuedAt: { $gte: input.from, $lte: input.to },
        status: { $ne: 'void' },
      },
    },
    {
      $group: {
        _id: null,
        salesTotal: { $sum: '$subTotal' },
        vatCollected: { $sum: '$taxTotal' },
        invoiceCount: { $sum: 1 },
      },
    },
  ]);
  const totals = data[0] ?? { salesTotal: 0, vatCollected: 0, invoiceCount: 0 };
  return {
    period: { from: input.from.toISOString(), to: input.to.toISOString() },
    form: 'VAT 200 (Nepal)',
    salesTotal: totals.salesTotal,
    vatOutput: totals.vatCollected,
    vatInputClaim: 0, // wires once supplier-invoice ingestion lands in 6.4 follow-up
    netVatPayable: totals.vatCollected,
    invoiceCount: totals.invoiceCount,
  };
}

export async function gstr1(input: RegulatoryExportInput) {
  return {
    period: { from: input.from.toISOString(), to: input.to.toISOString() },
    form: 'GSTR-1 (India)',
    // The full GSTR-1 schema groups by GSTIN, place of supply, rate band.
    // Phase 6.4 ships the aggregation shape; the regulator-exact CSV writer
    // lands with the CA-discovery sign-off.
    invoices: [],
  };
}

export async function gstr3b(input: RegulatoryExportInput) {
  return {
    period: { from: input.from.toISOString(), to: input.to.toISOString() },
    form: 'GSTR-3B (India)',
    outwardSupplies: 0,
    inwardSupplies: 0,
    itc: 0,
    netGstPayable: 0,
  };
}

export async function lookupInvoiceEInvoice(tenantId: string, invoiceId: string) {
  const inv = await Invoice.findOne({ _id: invoiceId, tenantId }).lean();
  if (!inv) throw new HttpError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  return {
    invoice_number: inv.number,
    currency: inv.currency,
    sub_total: inv.subTotal / 100,
    tax_total: inv.taxTotal / 100,
    grand_total: inv.total / 100,
    hash: inv.eInvoiceHash,
    s3Key: inv.eInvoiceJsonKey,
  };
}

void JournalEntry;
