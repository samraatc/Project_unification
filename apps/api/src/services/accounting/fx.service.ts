import { FxRate } from '../../db/models/index.js';

/**
 * FX rate lookup — multi-currency posting helper.
 *
 * Stores rates as `base/quote` with `rateBp` = rate × 10_000. The journal-entry
 * lines carry `fxRate` (float) so aggregations stay simple; this helper turns
 * a stored snapshot back into that float.
 */

export interface FxResolveInput {
  tenantId: string;
  base: string;
  quote: string;
  asOf?: Date;
}

export async function resolveFxRate(input: FxResolveInput): Promise<number> {
  if (input.base === input.quote) return 1;
  const row = await FxRate.findOne({
    tenantId: input.tenantId,
    base: input.base,
    quote: input.quote,
    asOf: { $lte: input.asOf ?? new Date() },
  })
    .sort({ asOf: -1 })
    .select('rateBp')
    .lean();
  if (!row) return 1;
  return row.rateBp / 10_000;
}

export async function upsertFxRate(input: { tenantId: string; base: string; quote: string; rate: number; asOf?: Date }) {
  return FxRate.create({
    tenantId: input.tenantId,
    base: input.base,
    quote: input.quote,
    rateBp: Math.round(input.rate * 10_000),
    asOf: input.asOf ?? new Date(),
  });
}
