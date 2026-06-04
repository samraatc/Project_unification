import { aramexProvider } from './aramex.js';
import { pathaoProvider } from './pathao.js';
import type { CourierCode, CourierProvider } from './types.js';

export type { CourierCode, CourierProvider, ScanEvent } from './types.js';

const REGISTRY: Record<CourierCode, CourierProvider> = {
  pathao: pathaoProvider,
  aramex: aramexProvider,
};

export function courierProvider(code: CourierCode): CourierProvider {
  const p = REGISTRY[code];
  if (!p) throw new Error(`No courier provider for ${code}`);
  return p;
}

export const COURIER_CODES: readonly CourierCode[] = ['pathao', 'aramex'];
