import { z } from 'zod';

/**
 * Runtime config validated with Zod (TRD §7 / Security-Requirements §5).
 * Fails fast on boot if any required env var is missing or malformed.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),

  MONGO_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017/unified?replicaSet=rs0&directConnection=true'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().optional(),

  CORS_ALLOWED_ORIGINS: z
    .string()
    // Storefront 3000 + admin 3001 + storybook 6006. Admin runs at its own host (D-0005).
    .default('http://localhost:3000,http://localhost:3001,http://localhost:6006')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),

  STOREFRONT_BASE_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_BASE_URL: z.string().url().default('http://localhost:3001'),
  /** Set to a parent domain (e.g. `.unified.example.com`) so the refresh cookie is
   * shared between the storefront and admin hosts (D-0005). Empty string in dev. */
  REFRESH_COOKIE_DOMAIN: z.string().default(''),

  SENTRY_DSN: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  cached = parsed.data;
  return cached;
}

export function resetEnv(): void {
  cached = null;
}
