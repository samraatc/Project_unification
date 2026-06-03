'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiFetch, type LoginResponse, type PermissionsResponse } from './api.js';

/**
 * Minimal access-token store. The refresh token lives in an HttpOnly cookie
 * scoped to the parent domain (D-0005), so the admin SPA never sees it; we
 * just exchange it via `/api/v1/auth/refresh` when the access token is near
 * expiry or the page reloads.
 *
 * Note: localStorage is intentionally NOT used (Security-Requirements §7).
 * The access token lives in component memory; on hard reload the page calls
 * /auth/refresh to recover a fresh one.
 */

interface AuthState {
  accessToken: string | null;
  user: LoginResponse['user'] | null;
  permissions: PermissionsResponse | null;
  signIn: (identifier: string, password: string, totp?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(res.accessToken);
      const perms = await apiFetch<PermissionsResponse>('/me/permissions', { accessToken: res.accessToken });
      setPermissions(perms);
      const me = await apiFetch<{ id: string; email?: string; profile?: { firstName?: string; lastName?: string } }>(
        '/me',
        { accessToken: res.accessToken },
      );
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

  const signIn = useCallback(async (identifier: string, password: string, totp?: string) => {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { identifier, password, totp },
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    const perms = await apiFetch<PermissionsResponse>('/me/permissions', { accessToken: res.accessToken });
    setPermissions(perms);
  }, []);

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
    () => ({ accessToken, user, permissions, signIn, signOut, refresh, loading }),
    [accessToken, user, permissions, signIn, signOut, refresh, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useHasPermission(permission: string): boolean {
  const { permissions } = useAuth();
  if (!permissions) return false;
  if (permissions.isSuperAdmin || permissions.permissions.includes('*')) return true;
  return permissions.permissions.includes(permission);
}
