/**
 * @unified/sdk — typed client over the Express API.
 *
 * The `schema.d.ts` file is generated from `apps/api/openapi.json` via
 * `pnpm --filter @unified/sdk generate`. Until that runs, this module exports
 * a thin `createClient` factory and the few hand-written types needed by Sprint 0.
 */
import createOpenApiFetch from 'openapi-fetch';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiPaths = any;

export interface SdkOptions {
  baseUrl: string;
  /** Bearer token. Refresh is handled by the caller in Sprint 0. */
  getAccessToken?: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
}

export function createSdk(opts: SdkOptions) {
  const client = createOpenApiFetch<ApiPaths>({
    baseUrl: opts.baseUrl,
    fetch: opts.fetch,
  });

  client.use({
    async onRequest({ request }) {
      const token = await opts.getAccessToken?.();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  });

  return client;
}

export type Sdk = ReturnType<typeof createSdk>;
