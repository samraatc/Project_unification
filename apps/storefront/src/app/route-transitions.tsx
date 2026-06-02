'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { fadeUp, tx } from '@unified/motion';

/**
 * Page transition wrapper. Design-System.md §4.6 — every route change
 * fade-and-slides via Framer Motion. Respects `prefers-reduced-motion`
 * implicitly because the CSS layer collapses transition durations.
 */
export function RouteTransitions({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        id="main"
        key={pathname}
        variants={fadeUp}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={tx.smooth}
        className="min-h-screen"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
