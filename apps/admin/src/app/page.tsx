'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth-store.js';

export default function IndexPage() {
  const { accessToken, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    redirect(accessToken ? '/dashboard' : '/sign-in');
  }, [accessToken, loading]);
  return null;
}
