'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { NeuButton, NeuCard, NeuInput } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface SocialAccount {
  _id: string;
  platform: 'facebook' | 'instagram' | 'tiktok';
  name?: string;
}

interface FormatConstraint {
  platform: string;
  captionMax: number;
  hashtagMax: number;
  mediaMax: number;
}

export default function ComposerPage() {
  const { accessToken } = useAuth();
  const [content, setContent] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ['social', 'accounts'],
    queryFn: () => apiFetch<{ data: SocialAccount[] }>('/social/accounts', { accessToken }),
    enabled: Boolean(accessToken),
  });

  const constraints = useQuery({
    queryKey: ['social', 'constraints'],
    queryFn: () => apiFetch<{ data: FormatConstraint[] }>('/social/accounts/format-constraints', { accessToken }),
    enabled: Boolean(accessToken),
  });

  const create = useMutation({
    mutationFn: async () => {
      return apiFetch<{ _id: string; status: string }>('/social/posts', {
        method: 'POST',
        accessToken,
        body: {
          content,
          mediaKeys: [],
          targets: selected.map((id) => ({ socialAccountId: id })),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          requiresApproval,
        },
      });
    },
    onSuccess: (data) => {
      setSubmitMsg(`Saved as ${data.status} (#${data._id.slice(-6)}).`);
      setContent('');
      setSelected([]);
      setScheduledAt('');
    },
  });

  // Surface the strictest constraint among selected targets — that's the effective limit.
  const effectiveConstraint = useMemo(() => {
    const selectedPlatforms = (accounts.data?.data ?? [])
      .filter((a) => selected.includes(a._id))
      .map((a) => a.platform);
    const rules = (constraints.data?.data ?? []).filter((c) => selectedPlatforms.includes(c.platform as SocialAccount['platform']));
    if (rules.length === 0) return null;
    return {
      captionMax: Math.min(...rules.map((r) => r.captionMax)),
      hashtagMax: Math.min(...rules.map((r) => r.hashtagMax)),
      mediaMax: Math.min(...rules.map((r) => r.mediaMax)),
    };
  }, [accounts.data, constraints.data, selected]);

  function toggleTarget(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <NeuCard>
        <h2 className="text-lg font-semibold">Compose</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-text-secondary" htmlFor="composer-content">
            Caption
          </label>
          <textarea
            id="composer-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full rounded-md bg-surface-sunken p-4 text-base shadow-neu-sunken focus:outline-none focus:ring-2 focus:ring-brand-primary"
            placeholder="What's the news?"
          />
          {effectiveConstraint ? (
            <p className="text-xs text-text-muted">
              {content.length} / {effectiveConstraint.captionMax} characters · max {effectiveConstraint.mediaMax}{' '}
              media · max {effectiveConstraint.hashtagMax} hashtags (strictest of selected platforms).
            </p>
          ) : null}

          <NeuInput
            label="Schedule (optional)"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            hint="Leave blank to publish on demand."
          />

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="h-4 w-4"
            />
            Send to Admin for approval before publishing
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <NeuButton
              loading={create.isPending}
              disabled={!content || selected.length === 0}
              onClick={() => create.mutate()}
            >
              {scheduledAt ? 'Save & schedule' : 'Save draft'}
            </NeuButton>
            {submitMsg ? <span className="text-sm text-success">{submitMsg}</span> : null}
          </div>
        </div>
      </NeuCard>

      <NeuCard>
        <h2 className="text-lg font-semibold">Publish to</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Pick the connected accounts that should receive this post.
        </p>
        <div className="mt-4 space-y-2">
          {(accounts.data?.data ?? []).map((a) => (
            <label key={a._id} className="flex items-center gap-3 rounded-md p-3 shadow-neu-soft">
              <input
                type="checkbox"
                checked={selected.includes(a._id)}
                onChange={() => toggleTarget(a._id)}
                className="h-4 w-4"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{a.name ?? a._id}</p>
                <p className="text-xs uppercase tracking-wide text-text-muted">{a.platform}</p>
              </div>
            </label>
          ))}
          {(accounts.data?.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-secondary">Connect an account first.</p>
          ) : null}
        </div>
      </NeuCard>
    </div>
  );
}
