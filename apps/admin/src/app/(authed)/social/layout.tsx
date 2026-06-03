'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const TABS: { href: string; label: string }[] = [
  { href: '/social/accounts', label: 'Accounts' },
  { href: '/social/composer', label: 'Composer' },
  { href: '/social/calendar', label: 'Calendar' },
  { href: '/social/inbox', label: 'Inbox' },
  { href: '/social/analytics', label: 'Analytics' },
  { href: '/social/library', label: 'Library' },
];

export default function SocialLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Social hub</h1>
      <p className="mt-1 text-text-secondary">
        Facebook, Instagram, and TikTok in one workflow.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Social hub sections">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
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
