'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';
import { tx } from '@unified/motion';

import { useAuth } from '@/lib/auth-store.js';

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(identifier, password, totp || undefined);
      router.push('/dashboard');
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ApiError shape
      const code = (err as any)?.code ?? 'UNKNOWN';
      if (code === 'TOTP_REQUIRED') {
        setNeedsTotp(true);
        setError('Enter your TOTP code to continue.');
      } else if (code === 'EMAIL_UNVERIFIED') {
        setError('Verify your email before signing in.');
      } else if (code === 'ACCOUNT_LOCKED') {
        setError('Account temporarily locked. Try again later.');
      } else {
        setError('Invalid credentials.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tx.smooth}
        className="w-full max-w-md"
      >
        <NeuCard>
          <h1 className="font-display text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Admin console — Unified Platform.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <NeuInput
              label="Email or phone"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
            <NeuInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {needsTotp ? (
              <NeuInput
                label="TOTP code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                hint="6-digit code from your authenticator app"
                required
              />
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            ) : null}
            <NeuButton type="submit" size="lg" loading={busy} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </NeuButton>
            <p className="pt-2 text-center text-sm text-text-secondary">
              <a href="/forgot-password" className="underline">
                Forgot password?
              </a>
            </p>
          </form>
        </NeuCard>
      </motion.div>
    </main>
  );
}
