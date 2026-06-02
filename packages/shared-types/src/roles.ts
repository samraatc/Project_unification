import { z } from 'zod';

/**
 * Built-in roles. PRD §3.5 — six roles plus unlimited custom roles composed
 * from individual permissions. Permissions land in Phase 1 (FR-002).
 */
export const BuiltInRole = z.enum([
  'super_admin',
  'admin',
  'editor',
  'accountant',
  'viewer',
  'auditor',
]);

export type BuiltInRole = z.infer<typeof BuiltInRole>;

/**
 * Permission strings use dot-namespaced `domain.action` form.
 * The full catalogue is in 04-security/RBAC.md (TBD) and grows per phase.
 */
export const Permission = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, 'Permissions must be domain.action lowercase');

export type Permission = z.infer<typeof Permission>;
