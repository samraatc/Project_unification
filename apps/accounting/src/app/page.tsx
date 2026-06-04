'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-store.js';

export default function IndexPage() {
  const { accessToken, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    redirect(accessToken ? '/ledger' : '/sign-in');
  }, [accessToken, loading]);
  return null;
}
