'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface BrandRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
}

export default function BrandsPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['catalogue', 'brands'],
    queryFn: () => apiFetch<{ data: BrandRow[] }>('/brands', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div>
      {query.isLoading ? (
        <div className="skeleton h-48" aria-busy role="status" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(query.data?.data ?? []).map((b) => (
            <NeuCard key={b._id} dense>
              <h3 className="text-base font-semibold">{b.name}</h3>
              <p className="text-xs font-mono text-text-muted">/{b.slug}</p>
              {b.description ? <p className="mt-2 text-sm text-text-secondary">{b.description}</p> : null}
            </NeuCard>
          ))}
          {(query.data?.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-secondary">No brands yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
