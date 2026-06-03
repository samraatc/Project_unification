import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  WEBHOOK_PORT: z.coerce.number().int().positive().default(4100),
  MONGO_URI: z
    .string()
    .default('mongodb://localhost:27017/unified?replicaSet=rs0&directConnection=true'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

export const env = EnvSchema.parse(process.env);
