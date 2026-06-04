'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useAuth, useEntitlement } from '@/lib/auth-store.js';

interface NavItem {
  href: string;
  label: string;
  entitlement?: string;
}

const NAV: NavItem[] = [
  { href: '/ledger', label: 'Ledger', entitlement: 'accounting.ledger' },
  { href: '/journals', label: 'Journals', entitlement: 'accounting.journals' },
  { href: '/reports/pl', label: 'P&L', entitlement: 'accounting.reports.pl' },
  { href: '/reports/balance-sheet', label: 'Balance sheet', entitlement: 'accounting.reports.balance_sheet' },
  { href: '/reports/trial-balance', label: 'Trial balance', entitlement: 'accounting.reports.trial_balance' },
  { href: '/tax', label: 'Tax returns', entitlement: 'accounting.tax.vat200' },
  { href: '/bank', label: 'Bank reconciliation', entitlement: 'accounting.bank_reconciliation' },
  { href: '/periods', label: 'Periods', entitlement: 'accounting.period_close' },
  { href: '/audit-pack', label: 'Audit pack', entitlement: 'accounting.audit_pack' },
  { href: '/billing', label: 'Billing' },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-surface-raised shadow-neu-soft">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-semibold">Unified</span>
            <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs text-brand-primary shadow-neu-soft">
              Accounting
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-text-muted">{user?.email ?? '—'}</span>
            <button onClick={() => void signOut()} className="rounded-md px-3 py-1.5 shadow-neu-soft active:shadow-neu-sunken">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[14rem_1fr]">
        <nav className="space-y-1" aria-label="Accounting sections">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </nav>

        <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {children}
        </motion.main>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const entitled = useEntitlement(item.entitlement ?? '');
  const gated = Boolean(item.entitlement) && !entitled;
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-shadow ${
        active ? 'bg-surface-sunken shadow-neu-sunken' : 'shadow-neu-soft hover:shadow-neu-raised'
      } ${gated ? 'opacity-60' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span>{item.label}</span>
      {gated ? <span className="text-xs text-text-muted">premium</span> : null}
    </Link>
  );
}
