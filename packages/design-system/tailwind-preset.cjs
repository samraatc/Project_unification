/**
 * Tailwind preset consumed by every app (`apps/storefront`, `apps/admin`, etc.).
 * Mirrors the design tokens in design-tokens/tokens.json so the same colour values
 * are reachable as both CSS variables and Tailwind class names.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          'primary-hover': 'var(--brand-primary-hover)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
        },
        surface: {
          DEFAULT: 'var(--surface-bg)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cabinet Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '22px',
        xl: '32px',
      },
      boxShadow: {
        'neu-raised': 'var(--shadow-neu-raised)',
        'neu-sunken': 'var(--shadow-neu-sunken)',
        'neu-soft': 'var(--shadow-neu-soft)',
        'neu-hover': 'var(--shadow-neu-hover)',
      },
      // Mobile-first breakpoints per Design-System.md §2.1.
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
};
