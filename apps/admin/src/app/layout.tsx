import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@unified/design-system/globals.css';

import { Providers } from './providers.js';

export const metadata: Metadata = {
  title: { default: 'Admin · Unified Platform', template: '%s · Admin · Unified Platform' },
  description: 'Operations console for the Unified Platform.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E8ECF3',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
