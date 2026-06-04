'use client';

import { motion } from 'framer-motion';

import { NeuButton, NeuCard } from '@unified/design-system';

export default function SignInPage() {
  const adminBase = process.env.NEXT_PUBLIC_ADMIN_BASE_URL ?? 'http://localhost:3001';
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <NeuCard>
          <h1 className="font-display text-2xl font-semibold">Sign in required</h1>
          <p className="mt-2 text-sm text-text-secondary">
            The premium accounting portal shares its sign-in with the admin console (D-0005).
            Sign in at the admin host; you&apos;ll be redirected back here automatically.
          </p>
          <div className="mt-4">
            <NeuButton onClick={() => (window.location.href = `${adminBase}/sign-in`)} size="lg">
              Go to admin sign-in
            </NeuButton>
          </div>
        </NeuCard>
      </motion.div>
    </main>
  );
}
