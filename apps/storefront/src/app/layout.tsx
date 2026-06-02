import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@unified/design-system/globals.css';

import { RouteTransitions } from './route-transitions.js';

export const metadata: Metadata = {
  title: {
    default: 'Unified Platform — One platform. Every channel. Zero reconciliation.',
    template: '%s · Unified Platform',
  },
  description:
    'Unified Marketing & E-Commerce Management Platform. Social, storefront, payments, fulfilment, and accounting in a single product.',
  openGraph: {
    type: 'website',
    siteName: 'Unified Platform',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E8ECF3' },
    { media: '(prefers-color-scheme: dark)', color: '#1E2230' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:rounded-md focus:bg-brand-primary focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <RouteTransitions>{children}</RouteTransitions>
      </body>
    </html>
  );
}
