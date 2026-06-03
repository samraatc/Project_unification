/**
 * Tiny typed API client for the admin SPA. The full `@unified/sdk` will land
 * once the OpenAPI surface stabilises; this file is the single boundary the
 * SPA crosses to talk to `/api/v1`.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const e = data as { code?: string; title?: string; detail?: string; details?: unknown } | null;
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.detail ?? e?.title ?? res.statusText, e?.details);
  }
  return data as T;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: { id: string; email?: string; firstName?: string; lastName?: string };
}

export interface PermissionsResponse {
  userId: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  entitlements: string[];
}
