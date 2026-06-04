'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const TABS = [
  { href: '/analytics', label: 'Overview' },
  { href: '/analytics/sales', label: 'Sales' },
  { href: '/analytics/inventory', label: 'Inventory' },
  { href: '/analytics/customers', label: 'Customers' },
];

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Analytics</h1>
      <p className="mt-1 text-text-secondary">Overview + per-module dashboards. Cached for 5 minutes per tenant.</p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Analytics sections">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-md px-4 py-2 text-sm transition-shadow ${
                active ? 'shadow-neu-sunken bg-surface-sunken' : 'shadow-neu-soft hover:shadow-neu-raised'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        {children}
      </motion.div>
    </div>
  );
}
