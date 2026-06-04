'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const TABS: { href: string; label: string }[] = [
  { href: '/catalogue/products', label: 'Products' },
  { href: '/catalogue/categories', label: 'Categories' },
  { href: '/catalogue/brands', label: 'Brands' },
  { href: '/catalogue/coupons', label: 'Coupons' },
];

export default function CatalogueLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Catalogue</h1>
      <p className="mt-1 text-text-secondary">Products, categories, brands, and promotions.</p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Catalogue sections">
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
