/**
 * GSAP helpers — ScrollTrigger registration and a `matchMedia` wrapper that
 * collapses pinned timelines on touch viewports per Design-System.md §10.
 *
 * Importing this module on the server is safe; `register()` is a no-op when
 * `window` is undefined.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

export function registerScrollTrigger(): typeof ScrollTrigger | null {
  if (typeof window === 'undefined') return null;
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return ScrollTrigger;
}

/**
 * Convenience wrapper: run `desktop` on viewports >=1024px, `mobile` below,
 * and skip both on `prefers-reduced-motion: reduce`.
 */
export function matchMedia(handlers: {
  desktop?: (ctx: gsap.Context) => void;
  mobile?: (ctx: gsap.Context) => void;
}): gsap.MatchMedia | null {
  const st = registerScrollTrigger();
  if (!st) return null;
  const mm = gsap.matchMedia();
  mm.add(
    {
      isDesktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
      isMobile: '(max-width: 1023px) and (prefers-reduced-motion: no-preference)',
    },
    (context) => {
      const { isDesktop, isMobile } = (context.conditions ?? {}) as Record<string, boolean>;
      if (isDesktop && handlers.desktop) handlers.desktop(context);
      if (isMobile && handlers.mobile) handlers.mobile(context);
    },
  );
  return mm;
}

export { gsap, ScrollTrigger };
