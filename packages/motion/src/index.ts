/**
 * @unified/motion — shared motion vocabulary.
 *
 * Mirrors Design-System.md §4. Every variant respects `prefers-reduced-motion`
 * by collapsing transforms to opacity-only when the user opts out (see
 * `useReducedMotionSafe` in @unified/ui-hooks once that package lands).
 */
import type { Transition, Variants } from 'framer-motion';

export const tx = {
  smooth: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
  spring: { type: 'spring', stiffness: 380, damping: 24 } satisfies Transition,
  gentle: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } satisfies Transition,
} as const;

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const slideUp: Variants = {
  initial: { opacity: 0, y: '100%' },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: '100%' },
};

/**
 * Stagger container — children using `item` (or any variant with `initial`/`animate`)
 * animate in sequence after an initial delay.
 */
export const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  } as Variants,
  item: fadeUp,
};

/**
 * Reduced-motion fallback: opacity-only variants for use when
 * `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
 */
export const reducedMotion: Record<string, Variants> = {
  fadeUp: fadeIn,
  scaleIn: fadeIn,
  slideUp: fadeIn,
};

export type Tx = typeof tx;
