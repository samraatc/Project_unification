'use client';

import { useQuery } from '@tanstack/react-query';

import { NeuCard } from '@unified/design-system';

import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/lib/auth-store.js';

interface RoleRow {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: string[];
}

export default function RolesPage() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<{ data: RoleRow[] }>('/roles', { accessToken }),
    enabled: Boolean(accessToken),
  });

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-3xl font-semibold">Roles</h1>
      <p className="mt-1 text-text-secondary">
        Built-in roles are locked. Custom roles can compose any permission code.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {query.isLoading ? (
          <>
            <div className="skeleton h-40" aria-busy role="status" />
            <div className="skeleton h-40" aria-busy role="status" />
          </>
        ) : (
          (query.data?.data ?? []).map((role) => (
            <NeuCard key={role._id}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{role.name}</h2>
                {role.isSystem ? (
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs shadow-neu-soft">
                    system
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-text-muted">{role.code}</p>
              {role.description ? <p className="mt-2 text-sm text-text-secondary">{role.description}</p> : null}
              <p className="mt-3 text-xs text-text-muted">
                {role.permissions.length === 1 && role.permissions[0] === '*'
                  ? 'Wildcard — every permission'
                  : `${role.permissions.length} permission(s)`}
              </p>
            </NeuCard>
          ))
        )}
      </div>
    </div>
  );
}
