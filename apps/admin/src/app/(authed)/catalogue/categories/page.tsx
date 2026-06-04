'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface CatNode {
  id: string;
  name: string;
  slug: string;
  depth: number;
  children: CatNode[];
}

export default function CategoriesPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['catalogue', 'categories'],
    queryFn: () => apiFetch<{ data: CatNode[] }>('/categories', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div>
      {query.isLoading ? (
        <div className="skeleton h-48" aria-busy role="status" />
      ) : (
        <NeuCard>
          <Tree nodes={query.data?.data ?? []} />
        </NeuCard>
      )}
    </div>
  );
}

function Tree({ nodes }: { nodes: CatNode[] }) {
  if (nodes.length === 0) return <p className="text-sm text-text-secondary">No categories yet.</p>;
  return (
    <ul className="space-y-1">
      {nodes.map((n) => (
        <li key={n.id}>
          <p className="text-sm">
            <span className="font-mono text-xs text-text-muted">/{n.slug}</span>
            <span className="ml-2">{n.name}</span>
          </p>
          {n.children?.length ? (
            <div className="ml-5 mt-1 border-l border-surface-sunken/40 pl-3">
              <Tree nodes={n.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
