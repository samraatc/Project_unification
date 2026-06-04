'use client';

import { useEffect, useState } from 'react';

import { NeuButton, NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';

interface MeResponse {
  id: string;
  preferences?: {
    notifications?: { email?: boolean; sms?: boolean; push?: boolean };
    marketingOptIn?: boolean;
  };
}

export default function NotificationPreferencesPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MeResponse>('/me').then(setMe).catch(() => setMe(null));
  }, []);

  async function update(channel: 'email' | 'sms' | 'push', value: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        body: { preferences: { notifications: { [channel]: value } } },
      });
      setMe(
        me
          ? {
              ...me,
              preferences: {
                ...me.preferences,
                notifications: { ...me.preferences?.notifications, [channel]: value },
              },
            }
          : null,
      );
      setMsg('Preference updated.');
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <div className="mx-auto mt-16 max-w-2xl skeleton h-32" aria-busy role="status" />;

  const n = me.preferences?.notifications ?? { email: true, sms: true, push: true };

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold">Notification preferences</h1>
      <p className="mt-2 text-text-secondary">Pick how we contact you about your orders.</p>
      <NeuCard className="mt-6 space-y-4">
        {(['email', 'sms', 'push'] as const).map((ch) => (
          <div key={ch} className="flex items-center justify-between">
            <span className="capitalize">{ch}</span>
            <NeuButton
              size="sm"
              variant={n[ch] ? 'primary' : 'ghost'}
              onClick={() => update(ch, !n[ch])}
              loading={busy}
            >
              {n[ch] ? 'On' : 'Off'}
            </NeuButton>
          </div>
        ))}
      </NeuCard>
      {msg ? <p className="mt-3 text-sm text-success">{msg}</p> : null}
    </section>
  );
}
