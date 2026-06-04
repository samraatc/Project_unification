import type { OrderDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';

/**
 * Order status state machine (PRD §3.2 / FR-008).
 *
 * Allowed edges. Side branches (cancelled / returned / refunded) are reachable
 * from a small set of source states only.
 */
type Status = OrderDoc['status'];

const TRANSITIONS: Record<Status, Status[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  returned: ['refunded'],
  refunded: [],
  cancelled: [],
};

export function isValidTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: Status, to: Status): void {
  if (!isValidTransition(from, to)) {
    throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `Cannot move order from ${from} to ${to}.`);
  }
}

export const TERMINAL_STATES: Set<Status> = new Set(['refunded', 'cancelled']);
