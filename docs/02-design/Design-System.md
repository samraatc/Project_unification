# Design System

**Project:** Unified Marketing & E-Commerce Management Platform
**Stack:** Next.js 14 + Tailwind CSS + Framer Motion + GSAP + Spline
**Version:** 1.0

---

## 1. Design Principles

The product is built around five principles. **Calm depth** — surfaces use soft Neumorphic elevation rather than hard shadows, giving the interface a tactile, premium feel without visual noise. **Motion as feedback** — every state change is animated; nothing snaps. Framer Motion handles UI animation, GSAP ScrollTrigger handles scroll-driven storytelling. **Progressive disclosure** — dense admin surfaces (orders, inventory, accounting) reveal complexity only when the user asks for it via expandable sections, sticky filters, and contextual popovers. **Touch-first** — every interactive control meets a 44×44 px minimum target. **Accessible by default** — WCAG 2.1 AA on storefront and admin; focus rings preserved; motion respects `prefers-reduced-motion`.

## 2. Brand & Tokens

### 2.1 Colour System

```css
:root {
  /* Brand */
  --brand-primary:        #6366F1;  /* Indigo 500 */
  --brand-primary-hover:  #4F46E5;
  --brand-secondary:      #14B8A6;  /* Teal 500 */
  --brand-accent:         #F59E0B;  /* Amber 500 */

  /* Neumorphic surface (light theme) */
  --surface-bg:           #E8ECF3;
  --surface-raised:       #ECF0F7;
  --surface-sunken:       #DDE3EE;
  --shadow-light:         #FFFFFF;
  --shadow-dark:          #C8CFDB;

  /* Neumorphic surface (dark theme) */
  --surface-bg-dark:      #1E2230;
  --surface-raised-dark:  #232838;
  --surface-sunken-dark:  #181C28;
  --shadow-light-dark:    #2A3042;
  --shadow-dark-dark:     #12141C;

  /* Text */
  --text-primary:         #0F172A;
  --text-secondary:       #475569;
  --text-muted:           #94A3B8;
  --text-inverse:         #F8FAFC;

  /* Semantic */
  --success:              #10B981;
  --warning:              #F59E0B;
  --error:                #EF4444;
  --info:                 #3B82F6;
}
```

### 2.2 Typography

```css
--font-sans:    'Inter', system-ui, sans-serif;
--font-display: 'Cabinet Grotesk', 'Inter', sans-serif;
--font-mono:    'JetBrains Mono', monospace;

/* Type scale (modular, 1.25 ratio) */
--text-xs:   0.75rem;
--text-sm:   0.875rem;
--text-base: 1rem;
--text-lg:   1.125rem;
--text-xl:   1.25rem;
--text-2xl:  1.5rem;
--text-3xl:  1.875rem;
--text-4xl:  2.25rem;
--text-5xl:  3rem;
--text-6xl:  3.75rem;
```

### 2.3 Spacing & Radius

```css
/* 4px base; t-shirt sizing on Tailwind defaults */
--radius-sm: 8px;
--radius-md: 14px;
--radius-lg: 22px;   /* Neumorphic card default */
--radius-xl: 32px;
--radius-full: 9999px;
```

### 2.4 Shadows — Neumorphism

```css
/* Raised card */
--shadow-neu-raised:
  9px 9px 18px var(--shadow-dark),
  -9px -9px 18px var(--shadow-light);

/* Sunken / pressed */
--shadow-neu-sunken:
  inset 6px 6px 12px var(--shadow-dark),
  inset -6px -6px 12px var(--shadow-light);

/* Subtle pill / chip */
--shadow-neu-soft:
  4px 4px 8px var(--shadow-dark),
  -4px -4px 8px var(--shadow-light);

/* Hover lift */
--shadow-neu-hover:
  14px 14px 28px var(--shadow-dark),
  -14px -14px 28px var(--shadow-light);
```

## 3. Neumorphic Component Library

### 3.1 NeuCard (base surface)

```jsx
// components/NeuCard.jsx
import { motion } from 'framer-motion';

export const NeuCard = ({ children, sunken = false, className = '', ...rest }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -2 }}
    className={`
      rounded-[22px] bg-[var(--surface-raised)] p-6
      ${sunken ? 'shadow-[var(--shadow-neu-sunken)]'
              : 'shadow-[var(--shadow-neu-raised)] hover:shadow-[var(--shadow-neu-hover)]'}
      transition-shadow duration-300
      ${className}
    `}
    {...rest}
  >
    {children}
  </motion.div>
);
```

### 3.2 NeuButton (with gesture animation)

```jsx
import { motion } from 'framer-motion';

export const NeuButton = ({ children, variant = 'primary', ...rest }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97, boxShadow: 'var(--shadow-neu-sunken)' }}
    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    className={`
      px-6 py-3 rounded-[14px] font-medium
      bg-[var(--surface-raised)] text-[var(--text-primary)]
      shadow-[var(--shadow-neu-soft)]
      active:shadow-[var(--shadow-neu-sunken)]
      focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]
      ${variant === 'primary' && 'bg-[var(--brand-primary)] text-white'}
    `}
    {...rest}
  >
    {children}
  </motion.button>
);
```

### 3.3 NeuInput / NeuTextField

Inputs render as a sunken Neumorphic well so the eye reads them as input regions without borders.

```jsx
<input className="
  bg-[var(--surface-bg)]
  shadow-[var(--shadow-neu-sunken)]
  rounded-[14px] px-4 py-3
  focus:shadow-[var(--shadow-neu-soft)]
  focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]
" />
```

### 3.4 NeuToggle, NeuSlider, NeuCheckbox

All follow the raised/sunken pattern: idle = raised; active/checked = sunken with brand-tinted inner shadow.

### 3.5 NeuChip (filter pill)

Used on PLP filter sidebar and tag clusters. Soft shadow, brand-tinted on active, with `whileHover` lift and `whileTap` press.

## 4. Motion System — Framer Motion

### 4.1 Core Motion Primitives

The system standardises on a single `transition` token used everywhere unless a specific override is required:

```js
export const tx = {
  smooth: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  spring: { type: 'spring', stiffness: 380, damping: 24 },
  gentle: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
};
```

### 4.2 Variants — `initial`, `animate`, `exit`

```js
export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -12 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.96 },
};
```

### 4.3 Staggered Children

```jsx
const container = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item = fadeUp;

<motion.ul variants={container} initial="initial" animate="animate">
  {products.map(p => (
    <motion.li key={p.id} variants={item}>{p.name}</motion.li>
  ))}
</motion.ul>
```

### 4.4 Shared-Element Transitions with `layoutId`

PDP image → PLP thumbnail, cart icon → cart drawer, and order card → order detail all use shared-layout transitions:

```jsx
<motion.img layoutId={`product-${id}`} src={hero} />
// ... on detail page:
<motion.img layoutId={`product-${id}`} src={hero} className="rounded-[22px]" />
```

### 4.5 Gesture-Driven Interactions

Cards: `whileHover={{ y: -4, scale: 1.01 }}`. Buttons: `whileTap={{ scale: 0.97 }}`. Sortable lists and carousel items: `whileDrag={{ scale: 1.04, zIndex: 10 }}` with `dragConstraints` and `dragElastic`. Sidebar collapse handle uses `whileHover` to peek and `whileTap` to commit.

### 4.6 Page Transitions — `AnimatePresence`

The Next.js app root wraps `<Component {...pageProps} />` in `<AnimatePresence mode="wait">` so route changes fade-and-slide between pages:

```jsx
<AnimatePresence mode="wait" initial={false}>
  <motion.main
    key={router.route}
    variants={fadeUp}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={tx.smooth}
  >
    <Component {...pageProps} />
  </motion.main>
</AnimatePresence>
```

## 5. Scroll Animation System

The product uses four scroll-animation tools, each chosen for a specific job — they are not interchangeable.

### 5.1 Intersection Observer (native)

Used for cheap one-shot reveals, lazy mounting, and analytics impression tracking. Wrapped in a `useInView` hook (or Framer Motion's `useInView`):

```jsx
const ref = useRef(null);
const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
return (
  <motion.section ref={ref} animate={inView ? 'animate' : 'initial'} variants={fadeUp}>
    ...
  </motion.section>
);
```

### 5.2 GSAP ScrollTrigger — Timeline Scrubbing

Used for hero parallax, sticky storytelling sections on Pricing and About, and the Premium feature scroller. Timelines are pinned and scrubbed proportionally to scroll progress:

```js
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

gsap.timeline({
  scrollTrigger: {
    trigger: '#pricing-story',
    start: 'top top',
    end: '+=2000',
    scrub: true,
    pin: true,
  },
})
.from('.plan-card', { y: 80, opacity: 0, stagger: 0.2 })
.to('.plan-card.lifetime', { scale: 1.06, boxShadow: 'var(--shadow-neu-hover)' });
```

### 5.3 AOS (Animate on Scroll)

Used only on marketing-style pages (About, Features, Blog) for low-friction class-based reveals where motion fidelity is not critical. Initialised once at app root with `AOS.init({ duration: 700, once: true, easing: 'ease-out-cubic' })`. Authors annotate elements with `data-aos="fade-up"`, `data-aos-delay="100"`.

### 5.4 Motion One

Used for lightweight micro-interactions (toast slide-in, badge ping, status-dot pulse) where Framer Motion would be overkill. Tree-shakes to ~3KB.

```js
import { animate, stagger } from 'motion';
animate('.toast', { transform: ['translateY(20px)', 'translateY(0)'], opacity: [0, 1] }, { duration: 0.35 });
```

## 6. Hero — Parallax + Spline

The storefront hero is the brand moment. Layered parallax background + a foreground **Spline** 3D scene that the cursor and scroll position drive together.

```jsx
import Spline from '@splinetool/react-spline';
import { useScroll, useTransform, motion } from 'framer-motion';

export const Hero = () => {
  const { scrollY } = useScroll();
  const yBg   = useTransform(scrollY, [0, 600], [0, 180]);
  const yMid  = useTransform(scrollY, [0, 600], [0, 90]);
  const yFg   = useTransform(scrollY, [0, 600], [0, 30]);

  return (
    <section className="relative h-[100vh] overflow-hidden">
      <motion.div style={{ y: yBg }} className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-teal-100" />
      <motion.div style={{ y: yMid }} className="absolute inset-0">
        <Spline scene="https://prod.spline.design/your-scene/scene.splinecode" />
      </motion.div>
      <motion.div style={{ y: yFg }} className="relative z-10 max-w-5xl mx-auto pt-32 px-6">
        <h1 className="text-6xl font-display font-bold">One platform. Every channel. Zero reconciliation.</h1>
      </motion.div>
    </section>
  );
};
```

Performance budget: Spline scene must be under 800KB; lazy-loaded with `IntersectionObserver`; falls back to a static hero image on `prefers-reduced-motion` and on devices reporting `deviceMemory < 4`.

## 7. Navigation Patterns

### 7.1 Collapsible Sidebar (Admin Console)

The admin sidebar collapses to a 72px icon rail and expands to 256px. Width animation uses Framer Motion's `layout` so child labels animate width/opacity in sync. Collapsed state is persisted in `localStorage`. Sub-menus open as Popovers on the collapsed state and inline expanders on the expanded state.

```jsx
<motion.aside
  animate={{ width: collapsed ? 72 : 256 }}
  transition={tx.smooth}
  className="bg-[var(--surface-raised)] shadow-[var(--shadow-neu-raised)]"
>
  ...
</motion.aside>
```

### 7.2 Mega Menu (Storefront catalogue)

Triggered from the sticky header. Renders a full-width panel with category columns, featured products, and a promo tile. Mount uses `AnimatePresence` with `scaleIn` + `staggerChildren` for the column reveal.

### 7.3 Floating / Sticky Header

The header transitions from transparent overlay (over hero) to a Neumorphic floating pill once scroll passes 80px. Implementation uses `useScroll` + `useTransform` to interpolate background opacity, blur, and shadow.

```jsx
const { scrollY } = useScroll();
const bg = useTransform(scrollY, [0, 80], ['rgba(232,236,243,0)', 'rgba(232,236,243,0.85)']);
const blur = useTransform(scrollY, [0, 80], [0, 12]);
<motion.header style={{ backgroundColor: bg, backdropFilter: useMotionTemplate`blur(${blur}px)` }} />
```

## 8. Overlays

### 8.1 Dialog / Modal

Built on Radix Dialog primitives styled to the Neumorphic system. Open/close via `AnimatePresence` + `scaleIn`. Backdrop blurs and dims. Trap focus. Close on `Esc` and backdrop click. Used for: add to cart, address picker, coupon picker, role editor, journal-entry editor.

### 8.2 Popover / Tooltip

Built on Radix Popover and Tooltip primitives. Popovers carry interactive content (filter selectors, account menu, notifications). Tooltips are non-interactive, 1-second hover delay, dismiss on `Esc`. Both use Motion One for the slide+fade (lightweight, not blocking layout).

### 8.3 Toast Notifications

Bottom-right stack. Each toast is a Neumorphic pill with an icon, message, and optional action. Slide-in via Motion One; auto-dismiss after 5s; swipe-right to dismiss on touch.

## 9. Skeleton Loaders

Every list, card, and table renders a Neumorphic-styled skeleton while data is fetching. Skeletons use a shimmering gradient via CSS animation (not Framer Motion — cheaper for many simultaneous skeletons):

```css
.skeleton {
  background: linear-gradient(90deg, var(--surface-sunken) 0%, var(--surface-raised) 50%, var(--surface-sunken) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: 14px;
}
@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

PLP, PDP, Cart, Orders, Inbox, Inventory, Reports — all have skeleton states matching the post-load layout to prevent CLS.

## 10. Sticky / Pinned Sections

Used on Pricing, Premium Features, About, and the Inventory dashboard. A section is pinned while inner steps advance with scroll. Implementation uses GSAP ScrollTrigger with `pin: true` and `scrub: true`. Each step is a Framer Motion variant transition driven by an `inView` sensor.

Pricing page example: the plan comparison panel pins at the top of the viewport while four feature-callout steps scroll past on the right; the active plan card glows via animated `box-shadow` change.

## 11. Accessibility

All animations respect `prefers-reduced-motion: reduce` and degrade to opacity-only transitions. Focus rings use a 3px outline in `--brand-primary` with 2px offset; never removed. Colour contrast: text on Neumorphic backgrounds must meet 4.5:1 (WCAG AA). Skeletons include `aria-busy="true"` and `role="status"`. Modals trap focus, restore focus on close, and announce open state via `aria-modal="true"`. Sticky sections do not steal focus.

## 12. Component Inventory

The system ships the following components, each with stories in Storybook:

NeuCard, NeuButton, NeuInput, NeuTextField, NeuSelect, NeuToggle, NeuCheckbox, NeuRadio, NeuSlider, NeuChip, NeuAvatar, NeuBadge, NeuTabs, NeuAccordion, NeuTable, NeuPagination, NeuBreadcrumb, NeuStepper, NeuProgress, NeuTooltip, NeuPopover, NeuDialog, NeuDrawer, NeuToast, NeuSkeleton, NeuEmptyState, NeuStat, NeuChart (wrapping Recharts), NeuCalendar, NeuDatePicker, NeuPhoneInput, NeuOTPInput, NeuFileUploader, NeuRichTextEditor (Tiptap), NeuMediaPicker.

Page-level patterns: Hero (parallax + Spline), MegaMenu, Sidebar, FloatingHeader, FilterSidebar, ProductCard, ProductGrid, CartDrawer, CheckoutStepper, OrderTimeline, KPIStat, RevenueChart, JournalEntryGrid.

## 13. Design Tokens — JSON Source of Truth

All tokens live in `design-tokens/tokens.json` and are transformed to Tailwind config and CSS variables via Style Dictionary. Designers update Figma variables → CI exports updated `tokens.json` → PR opens against the design system package.
