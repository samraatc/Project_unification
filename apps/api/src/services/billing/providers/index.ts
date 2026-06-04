import { esewaRecurring } from './esewaRecurring.js';
import { khaltiRecurring } from './khaltiRecurring.js';
import { stripeBilling } from './stripeBilling.js';
import type { BillingProvider, BillingProviderCode } from './types.js';

const REGISTRY: Record<BillingProviderCode, BillingProvider> = {
  stripe: stripeBilling,
  esewa: esewaRecurring,
  khalti: khaltiRecurring,
};

export function billingProviderFor(code: BillingProviderCode): BillingProvider {
  const p = REGISTRY[code];
  if (!p) throw new Error(`No billing provider for ${code}`);
  return p;
}

export const BILLING_PROVIDERS: readonly BillingProviderCode[] = ['stripe', 'esewa', 'khalti'];

export type {
  BillingProvider,
  BillingProviderCode,
  CheckoutHandoff,
  WebhookEvent,
} from './types.js';
