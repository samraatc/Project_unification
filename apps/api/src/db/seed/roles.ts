/**
 * Built-in role definitions — PRD §3.5. Seeded on first tenant boot.
 *
 * Custom roles are tenant-scoped and live alongside these.
 */
export interface RoleSeed {
  code: string;
  name: string;
  description: string;
  permissions: readonly string[];
}

const all = (...codes: readonly string[]): readonly string[] => codes;

export const ROLE_CATALOGUE: readonly RoleSeed[] = [
  {
    code: 'super_admin',
    name: 'Super Admin',
    description: 'Full system control + billing + RBAC. Only role that can manage other Super Admins.',
    permissions: ['*'],
  },
  {
    code: 'admin',
    name: 'Admin',
    description: 'Day-to-day operations. Cannot manage Super Admins or system configuration.',
    permissions: all(
      'users.read', 'users.create', 'users.update',
      'roles.read', 'roles.assign',
      'audit.read',
      'products.read', 'products.create', 'products.update', 'products.delete',
      'catalogue.update',
      'orders.read', 'orders.update',
      'inventory.read', 'inventory.adjust',
      'purchasing.read', 'purchasing.create', 'purchasing.update',
      'social.read', 'social.connect', 'social.draft', 'social.schedule', 'social.publish', 'social.analytics',
      'inbox.read', 'inbox.reply', 'inbox.assign',
      'billing.read',
      'webhooks.read', 'webhooks.create', 'webhooks.update',
    ),
  },
  {
    code: 'editor',
    name: 'Editor',
    description: 'Content + catalogue staff. No finance or user-management.',
    permissions: all(
      'products.read', 'products.create', 'products.update',
      'catalogue.update',
      'orders.read', 'orders.update',
      'social.read', 'social.draft', 'social.schedule',
      'inbox.read', 'inbox.reply',
    ),
  },
  {
    code: 'accountant',
    name: 'Accountant',
    description: 'Finance focus. Gateway to the Premium Accounting module.',
    permissions: all(
      'orders.read',
      'orders.refund',
      'billing.read',
      'audit.read',
      'accounting.read',
      'accounting.write',
      'accounting.tax',
      'accounting.export',
    ),
  },
  {
    code: 'viewer',
    name: 'Viewer',
    description: 'Read-only across modules. Investors, juniors, stakeholders.',
    permissions: all(
      'users.read',
      'products.read',
      'orders.read',
      'inventory.read',
      'social.read', 'social.analytics',
      'inbox.read',
      'billing.read',
      'accounting.read',
    ),
  },
  {
    code: 'auditor',
    name: 'Auditor',
    description: 'External auditor access — audit log + accounting reports only.',
    permissions: all(
      'audit.read',
      'accounting.read',
      'accounting.export',
    ),
  },
] as const;
