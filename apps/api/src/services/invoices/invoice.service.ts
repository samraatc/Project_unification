/**
 * Invoice PDF generator.
 *
 * Phase 3.6 ships a portable HTML+JSON representation. Phase 3.6 follow-up wires
 * `pdfkit` (Sprint plan decision D-0007 — chosen over puppeteer for runtime
 * cost) and pipes the buffer to S3 under `tenants/{tenantId}/invoices/{number}.pdf`.
 *
 * This module exposes a single `generateInvoice(order)` that returns the buffer
 * + key; the route stores `order.invoicePdfKey` and returns a signed download URL.
 */

import type { OrderDoc } from '../../db/models/index.js';

export interface InvoicePayload {
  invoiceNumber: string;
  issuedAt: string;
  seller: { name: string; address: string; taxId?: string };
  buyer: { name: string; email?: string; phone?: string; address?: unknown };
  lineItems: Array<{
    sku: string;
    description: string;
    qty: number;
    unitPrice: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
  }>;
  totals: OrderDoc['totals'];
  currency: string;
  payment: { method?: string; status?: string; gatewayRef?: string };
}

export function buildInvoicePayload(order: OrderDoc): InvoicePayload {
  return {
    invoiceNumber: order.number,
    issuedAt: new Date().toISOString(),
    seller: {
      name: process.env.INVOICE_SELLER_NAME ?? 'Elskov Services',
      address: process.env.INVOICE_SELLER_ADDRESS ?? 'Kathmandu, Nepal',
      taxId: process.env.INVOICE_SELLER_TAX_ID,
    },
    buyer: {
      name: order.shipping?.address && typeof order.shipping.address === 'object'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- snapshot shape
        ? ((order.shipping.address as any).contactName ?? 'Customer')
        : 'Customer',
      email: order.guestEmail,
      address: order.shipping?.address,
    },
    lineItems: order.items.map((it) => ({
      sku: it.sku,
      description: it.name,
      qty: it.qty,
      unitPrice: it.unitPrice,
      subtotal: it.subtotal,
      taxRate: it.taxRate ?? 0,
      taxAmount: it.taxAmount ?? 0,
    })),
    totals: order.totals,
    currency: order.currency ?? 'USD',
    payment: {
      method: order.payment?.method,
      status: order.payment?.status,
      gatewayRef: order.payment?.gatewayRef,
    },
  };
}

/**
 * Returns the would-be PDF buffer. Phase 3.6 follow-up swaps the stub for a real
 * pdfkit doc; the call site (S3 upload, signed-URL emit) is unchanged.
 */
export async function renderInvoicePdf(payload: InvoicePayload): Promise<Buffer> {
  // TODO(phase-3.6 follow-up): pipe a `PDFKit` doc to a PassThrough and concat.
  const stubText = `INVOICE ${payload.invoiceNumber}\n${JSON.stringify(payload, null, 2)}`;
  return Buffer.from(stubText, 'utf8');
}

export function invoiceS3Key(tenantId: string, invoiceNumber: string): string {
  return `tenants/${tenantId}/invoices/${invoiceNumber}.pdf`;
}
