/** Phase 5 — analytics + reports shape tests (no DB required). */
import { describe, expect, it } from 'vitest';

import { REPORT_DEFINITIONS, resolveWindow } from '../src/services/reports/definitions.js';
import { renderReport, type ReportDataset } from '../src/services/reports/formats.js';

describe('report definitions registry', () => {
  it('exposes every documented key', () => {
    expect(Object.keys(REPORT_DEFINITIONS).sort()).toEqual([
      'customer_segments',
      'inventory_snapshot',
      'orders_full',
      'sales_summary',
    ]);
  });
});

describe('resolveWindow', () => {
  it('returns the right span per spec', () => {
    const { from, to } = resolveWindow('last_24h');
    const hours = (to.getTime() - from.getTime()) / 3600_000;
    expect(hours).toBeGreaterThanOrEqual(23.5);
    expect(hours).toBeLessThanOrEqual(24.5);
  });

  it('defaults to 7 days when nothing is provided', () => {
    const { from, to } = resolveWindow(undefined);
    const days = (to.getTime() - from.getTime()) / (3600_000 * 24);
    expect(Math.round(days)).toBe(7);
  });
});

describe('renderReport — CSV', () => {
  it('escapes commas and quotes', async () => {
    const dataset: ReportDataset = {
      title: 'Test',
      generatedAt: new Date('2026-06-04T00:00:00Z'),
      columns: [
        { key: 'a', header: 'A' },
        { key: 'b', header: 'B,with comma' },
      ],
      rows: [{ a: 'hello, world', b: 'has "quotes"' }],
    };
    const out = await renderReport(dataset, 'csv');
    const text = out.buffer.toString('utf8');
    expect(text).toContain('"B,with comma"');
    expect(text).toContain('"hello, world"');
    expect(text).toContain('"has ""quotes"""');
    expect(out.contentType).toBe('text/csv; charset=utf-8');
    expect(out.extension).toBe('csv');
  });

  it('appends a totals row when present', async () => {
    const dataset: ReportDataset = {
      title: 'T',
      generatedAt: new Date(),
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'orders', header: 'Orders' },
      ],
      rows: [{ date: '2026-06-01', orders: 5 }],
      totals: { date: 'Total', orders: 5 },
    };
    const out = await renderReport(dataset, 'csv');
    expect(out.buffer.toString('utf8')).toContain('Total,5');
  });
});
