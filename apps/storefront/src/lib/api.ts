/** Storefront-side API client. Mirrors `apps/admin/src/lib/api.ts`. */

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
  signal?: AbortSignal;
  cache?: RequestCache;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
    signal: opts.signal,
    cache: opts.cache,
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

export function money(amount: number, currency = 'USD'): string {
  // amount in minor units
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
