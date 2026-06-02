'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

import { tx } from '@unified/motion';

import { cn } from '../utils/cn.js';

export interface NeuCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: ReactNode;
  /** Sunken (inset) shadow style — for input wells, pressed states. */
  sunken?: boolean;
  /**
   * Compact padding for sub-768px viewports where the default p-6 + raised shadows
   * crowd the layout (responsiveness guardrail §2.2).
   */
  dense?: boolean;
}

/**
 * NeuCard — base Neumorphic surface.
 *
 * Design-System.md §3.1. Adapts shadow + padding for small viewports per
 * the responsiveness directive: deep `neu-raised` shadows on `xl`+, soft on
 * mobile, padding shrinks to p-4 when `dense`.
 */
export const NeuCard = forwardRef<HTMLDivElement, NeuCardProps>(function NeuCard(
  { children, sunken = false, dense = false, className, ...rest },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tx.smooth}
      whileHover={sunken ? undefined : { y: -2 }}
      className={cn(
        'rounded-lg bg-surface-raised transition-shadow duration-300',
        dense ? 'p-4' : 'p-4 sm:p-6',
        sunken
          ? 'shadow-neu-sunken'
          : 'shadow-neu-soft sm:shadow-neu-raised hover:shadow-neu-hover',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
});
