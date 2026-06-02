'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

import { NeuButton } from '@unified/design-system';
import { tx } from '@unified/motion';

/**
 * Hero stub — Sprint 0 placeholder.
 *
 * Sprint 3 will slot the Spline scene into the mid-layer (`yMid`) per the
 * design handoff opened against this PR. Until then we ship a layered
 * gradient + parallax `useScroll`/`useTransform` skeleton so the motion
 * contract is wired and visible in QA.
 *
 * Responsiveness directive §4 — `prefers-reduced-motion` and low-memory
 * devices fall back to a static hero (no parallax) via CSS + the placeholder.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollY } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yBg = useTransform(scrollY, [0, 600], [0, 180]);
  const yMid = useTransform(scrollY, [0, 600], [0, 90]);
  const yFg = useTransform(scrollY, [0, 600], [0, 30]);

  return (
    <section
      ref={ref}
      className="relative min-h-[100vh] overflow-hidden"
      aria-label="Unified Platform hero"
    >
      <motion.div
        aria-hidden
        style={{ y: yBg }}
        className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-surface to-teal-100"
      />
      <motion.div
        aria-hidden
        style={{ y: yMid }}
        className="absolute inset-0 flex items-center justify-center motion-reduce:hidden"
      >
        {/* TODO(design): drop Spline scene here once asset arrives. */}
        <div className="h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl sm:h-96 sm:w-96" />
      </motion.div>

      <motion.div
        style={{ y: yFg }}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...tx.gentle, delay: 0.1 }}
        className="relative z-10 mx-auto max-w-5xl px-6 pt-32 sm:pt-48"
      >
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-brand-secondary">
          Unified Platform
        </p>
        <h1 className="text-balance font-display text-4xl font-bold leading-tight sm:text-5xl xl:text-6xl">
          One platform. Every channel. Zero reconciliation.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-text-secondary">
          Social, storefront, payments, fulfilment, and accounting in a single
          subscription-extensible product — replacing the typical SMB SaaS stack.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <NeuButton size="lg" variant="primary">
            Start free trial
          </NeuButton>
          <NeuButton size="lg" variant="secondary">
            Watch the demo
          </NeuButton>
        </div>
      </motion.div>
    </section>
  );
}
