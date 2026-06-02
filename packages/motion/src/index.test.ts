import { describe, expect, it } from 'vitest';

import { fadeUp, scaleIn, stagger, tx } from './index.js';

describe('motion tokens', () => {
  it('smooth transition matches Design-System.md §4.1', () => {
    expect(tx.smooth).toEqual({ duration: 0.4, ease: [0.22, 1, 0.36, 1] });
  });

  it('fadeUp ships initial/animate/exit', () => {
    expect(fadeUp).toHaveProperty('initial');
    expect(fadeUp).toHaveProperty('animate');
    expect(fadeUp).toHaveProperty('exit');
  });

  it('scaleIn starts at scale 0.92', () => {
    expect((scaleIn.initial as { scale: number }).scale).toBeCloseTo(0.92);
  });

  it('stagger container schedules children', () => {
    const animate = (stagger.container.animate ?? {}) as { transition?: { staggerChildren: number } };
    expect(animate.transition?.staggerChildren).toBe(0.08);
  });
});
