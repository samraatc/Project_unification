'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard, NeuInput } from '@unified/design-system';
import { useState } from 'react';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface MediaRow {
  _id: string;
  key: string;
  mime: string;
  sizeBytes: number;
  tags: string[];
  altText?: string;
  uploadedAt: string;
}

export default function LibraryPage() {
  const { accessToken } = useAuth();
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['social', 'library', q],
    queryFn: () =>
      apiFetch<{ data: MediaRow[] }>(`/social/media${q ? `?q=${encodeURIComponent(q)}` : ''}`, { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="space-y-4">
      <NeuInput
        label="Search alt text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="hero, product, banner…"
      />
      {query.isLoading ? (
        <div className="skeleton h-64" aria-busy role="status" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(query.data?.data ?? []).map((m) => (
            <NeuCard key={m._id} dense>
              <p className="break-words font-mono text-xs text-text-muted">{m.key.split('/').slice(-1)[0]}</p>
              <p className="mt-2 text-xs">{m.mime}</p>
              <p className="text-xs text-text-muted">{(m.sizeBytes / 1024).toFixed(0)} KB</p>
              {m.altText ? <p className="mt-2 text-xs">{m.altText}</p> : null}
            </NeuCard>
          ))}
          {(query.data?.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-secondary">No media yet. Upload via the composer.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
