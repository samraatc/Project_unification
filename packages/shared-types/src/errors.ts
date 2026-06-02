import { z } from 'zod';

/**
 * RFC 7807-aligned error envelope. The Express error handler emits this shape.
 */
export const ProblemDetails = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  details: z.unknown().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetails>;
