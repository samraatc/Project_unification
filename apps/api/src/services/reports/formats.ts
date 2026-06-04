/**
 * Report format adapters (D-0014).
 *
 * Each format renders a `ReportDataset` (columns + rows) to a buffer. CSV is
 * always-on (no extra dependency). XLSX wires `exceljs`, PDF uses the `pdfkit`
 * choice from D-0007. Phase 5 ships CSV inline and stubs XLSX + PDF behind the
 * same interface so callers don't change when the libs land.
 */

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportDataset {
  title: string;
  generatedAt: Date;
  columns: Array<{ key: string; header: string }>;
  rows: Array<Record<string, string | number | null | undefined>>;
  /** Totals row appended at the bottom (xlsx/pdf only). */
  totals?: Record<string, string | number>;
}

export interface RenderResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

export async function renderReport(dataset: ReportDataset, format: ReportFormat): Promise<RenderResult> {
  switch (format) {
    case 'csv':
      return renderCsv(dataset);
    case 'xlsx':
      return renderXlsxStub(dataset);
    case 'pdf':
      return renderPdfStub(dataset);
  }
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function renderCsv(dataset: ReportDataset): RenderResult {
  const lines: string[] = [];
  lines.push(dataset.columns.map((c) => escapeCsv(c.header)).join(','));
  for (const row of dataset.rows) {
    lines.push(dataset.columns.map((c) => escapeCsv(row[c.key])).join(','));
  }
  if (dataset.totals) {
    const totalsRow = dataset.columns.map((c) => escapeCsv(dataset.totals?.[c.key]));
    lines.push(totalsRow.join(','));
  }
  return {
    buffer: Buffer.from(lines.join('\n'), 'utf8'),
    contentType: 'text/csv; charset=utf-8',
    extension: 'csv',
  };
}

function renderXlsxStub(dataset: ReportDataset): RenderResult {
  // TODO(phase-5.2 follow-up): `import ExcelJS from 'exceljs'` + workbook build.
  // Phase 5 ships a JSON wrapper so the file is still useful in dev.
  const payload = {
    note: 'stub xlsx — real workbook lands with exceljs follow-up',
    dataset,
  };
  return {
    buffer: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  };
}

function renderPdfStub(dataset: ReportDataset): RenderResult {
  // TODO(phase-5.2 follow-up): pdfkit doc with table.
  const text = [
    dataset.title,
    `Generated: ${dataset.generatedAt.toISOString()}`,
    '',
    dataset.columns.map((c) => c.header).join('\t'),
    ...dataset.rows.map((r) => dataset.columns.map((c) => String(r[c.key] ?? '')).join('\t')),
  ].join('\n');
  return {
    buffer: Buffer.from(text, 'utf8'),
    contentType: 'application/pdf',
    extension: 'pdf',
  };
}
