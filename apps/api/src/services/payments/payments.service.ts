import type { CartDoc, CheckoutSessionDoc } from '../../db/models/index.js';
import { codGateway } from './cod.gateway.js';
import { esewaGateway } from './esewa.gateway.js';
import { khaltiGateway } from './khalti.gateway.js';
import { paypalGateway } from './paypal.gateway.js';
import { stripeGateway } from './stripe.gateway.js';
import type {
  InitiateOutput,
  PaymentGateway,
  PaymentMethod,
  RefundOutput,
  VerifyOutput,
} from './types.js';

const REGISTRY: Record<PaymentMethod, PaymentGateway> = {
  stripe: stripeGateway,
  esewa: esewaGateway,
  khalti: khaltiGateway,
  paypal: paypalGateway,
  cod: codGateway,
};

export function gatewayFor(method: PaymentMethod): PaymentGateway {
  const g = REGISTRY[method];
  if (!g) throw new Error(`No gateway registered for ${method}`);
  return g;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['stripe', 'esewa', 'khalti', 'paypal', 'cod'];

export interface OrchestrateInitiateInput {
  method: PaymentMethod;
  cart: CartDoc;
  session: CheckoutSessionDoc;
}

export async function initiatePayment(input: OrchestrateInitiateInput): Promise<InitiateOutput> {
  return gatewayFor(input.method).initiate({ cart: input.cart, session: input.session });
}

export interface OrchestrateVerifyInput {
  method: PaymentMethod;
  cart: CartDoc;
  session: CheckoutSessionDoc;
  gatewayRef: string;
}

export async function verifyPayment(input: OrchestrateVerifyInput): Promise<VerifyOutput> {
  return gatewayFor(input.method).verify({ cart: input.cart, session: input.session, gatewayRef: input.gatewayRef });
}

export interface OrchestrateRefundInput {
  method: PaymentMethod;
  orderId: string;
  gatewayRef: string;
  amount: number;
  currency: string;
}

export async function refundPayment(input: OrchestrateRefundInput): Promise<RefundOutput> {
  return gatewayFor(input.method).refund({
    orderId: input.orderId,
    gatewayRef: input.gatewayRef,
    amount: input.amount,
    currency: input.currency,
  });
}
