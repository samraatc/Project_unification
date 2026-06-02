'use client';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';
import { stagger } from '@unified/motion';
import { motion } from 'framer-motion';

/**
 * Inline showcase of the Sprint 0 Neumorphic primitives. Doubles as a
 * smoke-test surface on the staging deploy.
 */
export function PrimitivesShowcase() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24" aria-labelledby="ds-showcase">
      <h2 id="ds-showcase" className="font-display text-3xl font-semibold">
        Design system seed
      </h2>
      <p className="mt-2 text-text-secondary">
        NeuCard, NeuButton, NeuInput — the three primitives that ship with Sprint 0.
      </p>

      <motion.div
        variants={stagger.container}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '0px 0px -10% 0px' }}
        className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        <motion.div variants={stagger.item}>
          <NeuCard>
            <h3 className="text-lg font-semibold">NeuCard</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Raised Neumorphic surface — soft on mobile, full elevation on ≥640px.
            </p>
          </NeuCard>
        </motion.div>

        <motion.div variants={stagger.item}>
          <NeuCard>
            <h3 className="text-lg font-semibold">NeuButton</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Press-to-sunken gesture with a 44×44 tap target on every size.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <NeuButton size="sm">Small</NeuButton>
              <NeuButton size="md" variant="secondary">
                Medium
              </NeuButton>
            </div>
          </NeuCard>
        </motion.div>

        <motion.div variants={stagger.item}>
          <NeuCard>
            <h3 className="text-lg font-semibold">NeuInput</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Sunken well; 16px text floor blocks iOS auto-zoom.
            </p>
            <div className="mt-4">
              <NeuInput label="Email" type="email" placeholder="you@example.com" />
            </div>
          </NeuCard>
        </motion.div>
      </motion.div>
    </section>
  );
}
