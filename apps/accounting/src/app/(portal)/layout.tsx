'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { PortalShell } from '@/components/PortalShell.js';
import { useAuth } from '@/lib/auth-store.js';

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { accessToken, loading } = useAuth();
  useEffect(() => {
    if (!loading && !accessToken) redirect('/sign-in');
  }, [accessToken, loading]);
  if (loading) return <div className="skeleton mx-auto mt-16 h-32 max-w-3xl" aria-busy role="status" />;
  if (!accessToken) return null;
  return <PortalShell>{children}</PortalShell>;
}
