'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiFetch } from './api.js';

interface MeResponse {
  id: string;
  email?: string;
  profile?: { firstName?: string; lastName?: string };
}

interface PermissionsResponse {
  userId: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  entitlements: string[];
}

interface AuthState {
  accessToken: string | null;
  user: { id: string; email?: string; firstName?: string; lastName?: string } | null;
  permissions: PermissionsResponse | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthState['user']>(null);
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/refresh', { method: 'POST' });
      setAccessToken(res.accessToken);
      const perms = await apiFetch<PermissionsResponse>('/me/permissions', { accessToken: res.accessToken });
      setPermissions(perms);
      const me = await apiFetch<MeResponse>('/me', { accessToken: res.accessToken });
      setUser({ id: me.id, email: me.email, firstName: me.profile?.firstName, lastName: me.profile?.lastName });
    } catch {
      setAccessToken(null);
      setUser(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    if (accessToken) {
      try {
        await apiFetch('/auth/logout', { method: 'POST', accessToken });
      } catch {
        // ignore
      }
    }
    setAccessToken(null);
    setUser(null);
    setPermissions(null);
  }, [accessToken]);

  const value = useMemo<AuthState>(
    () => ({ accessToken, user, permissions, loading, signOut }),
    [accessToken, user, permissions, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useEntitlement(code: string): boolean {
  const { permissions } = useAuth();
  if (!permissions) return false;
  return permissions.entitlements.includes(code) || permissions.entitlements.includes('*');
}
