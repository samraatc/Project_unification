/**
 * Permission catalogue — seeded into the `permissions` collection on boot.
 * Mirrors API.md per-route guards. Format: { code: 'domain.action', description, isPremium }.
 *
 * When adding a permission: add it here, update the route guard, update the role
 * permissions in `roles.ts` seed if a built-in role should get it.
 */
export interface PermissionSeed {
  code: string;
  domain: string;
  description: string;
  isPremium?: boolean;
}

export const PERMISSION_CATALOGUE: readonly PermissionSeed[] = [
  // Users + RBAC
  { code: 'users.read', domain: 'users', description: 'List/view users' },
  { code: 'users.create', domain: 'users', description: 'Invite/create user' },
  { code: 'users.update', domain: 'users', description: 'Edit user profile/status' },
  { code: 'users.delete', domain: 'users', description: 'Soft-delete user' },
  { code: 'roles.read', domain: 'roles', description: 'List roles + permission catalogue' },
  { code: 'roles.create', domain: 'roles', description: 'Create custom role' },
  { code: 'roles.update', domain: 'roles', description: 'Update role permissions' },
  { code: 'roles.delete', domain: 'roles', description: 'Delete non-system role' },
  { code: 'roles.assign', domain: 'roles', description: 'Assign roles to users' },
  { code: 'audit.read', domain: 'audit', description: 'View audit log' },

  // Catalogue
  { code: 'products.read', domain: 'catalogue', description: 'List/view products' },
  { code: 'products.create', domain: 'catalogue', description: 'Create products' },
  { code: 'products.update', domain: 'catalogue', description: 'Edit products' },
  { code: 'products.delete', domain: 'catalogue', description: 'Delete/archive products' },
  { code: 'catalogue.update', domain: 'catalogue', description: 'Manage categories + brands' },

  // Orders
  { code: 'orders.read', domain: 'orders', description: 'List/view orders' },
  { code: 'orders.update', domain: 'orders', description: 'Transition order status' },
  { code: 'orders.refund', domain: 'orders', description: 'Issue refunds' },

  // Inventory
  { code: 'inventory.read', domain: 'inventory', description: 'View inventory levels' },
  { code: 'inventory.adjust', domain: 'inventory', description: 'Adjust stock with audit' },
  { code: 'purchasing.read', domain: 'inventory', description: 'List/view purchase orders' },
  { code: 'purchasing.create', domain: 'inventory', description: 'Create POs' },
  { code: 'purchasing.update', domain: 'inventory', description: 'Receive PO items' },

  // Social
  { code: 'social.read', domain: 'social', description: 'View social accounts/posts' },
  { code: 'social.connect', domain: 'social', description: 'Connect/disconnect accounts' },
  { code: 'social.draft', domain: 'social', description: 'Create/edit drafts' },
  { code: 'social.schedule', domain: 'social', description: 'Schedule posts' },
  { code: 'social.publish', domain: 'social', description: 'Publish/approve posts' },
  { code: 'social.analytics', domain: 'social', description: 'View social analytics' },
  { code: 'inbox.read', domain: 'social', description: 'View social inbox' },
  { code: 'inbox.reply', domain: 'social', description: 'Reply to inbox messages' },
  { code: 'inbox.assign', domain: 'social', description: 'Assign inbox threads' },

  // Billing
  { code: 'billing.read', domain: 'billing', description: 'View subscription + invoices' },
  { code: 'billing.purchase', domain: 'billing', description: 'Start checkout for plan' },
  { code: 'billing.cancel', domain: 'billing', description: 'Cancel subscription' },

  // Webhooks
  { code: 'webhooks.read', domain: 'webhooks', description: 'List outbound webhooks' },
  { code: 'webhooks.create', domain: 'webhooks', description: 'Register outbound webhooks' },
  { code: 'webhooks.update', domain: 'webhooks', description: 'Edit/rotate webhooks' },

  // Premium accounting
  { code: 'accounting.read', domain: 'accounting', description: 'View ledger + reports', isPremium: true },
  { code: 'accounting.write', domain: 'accounting', description: 'Manual journal entries', isPremium: true },
  { code: 'accounting.close', domain: 'accounting', description: 'Period close / reopen', isPremium: true },
  { code: 'accounting.export', domain: 'accounting', description: 'Audit-pack export', isPremium: true },
  { code: 'accounting.tax', domain: 'accounting', description: 'Tax returns + e-invoice', isPremium: true },
] as const;
