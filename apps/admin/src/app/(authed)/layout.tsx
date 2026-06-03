'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/Sidebar.js';
import { useAuth } from '@/lib/auth-store.js';

export default function AuthedLayout({ children }: { children: ReactNode }) {
  const { accessToken, loading } = useAuth();
  useEffect(() => {
    if (!loading && !accessToken) redirect('/sign-in');
  }, [accessToken, loading]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="skeleton h-8 w-48" aria-busy role="status" />
      </main>
    );
  }
  if (!accessToken) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
