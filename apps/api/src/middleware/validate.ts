import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Zod-backed request validator. PRD §FR-002: no `req.body` reaches a Mongo query
 * without validation. Also rejects `$`-prefixed keys to defuse Mongo operator injection.
 */
function hasOperatorKeys(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    const child = (value as Record<string, unknown>)[key];
    if (child && typeof child === 'object' && hasOperatorKeys(child)) return true;
  }
  return false;
}

type Source = 'body' | 'query' | 'params';

export function validate<T>(
  schema: ZodSchema<T>,
  source: Source = 'body',
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const candidate = req[source];
    if (hasOperatorKeys(candidate)) {
      res.status(400).json({
        type: 'about:blank',
        title: 'Disallowed key in payload',
        status: 400,
        code: 'INVALID_KEY',
        detail: 'Mongo operator keys ($, .) are rejected by the API gateway.',
      });
      return;
    }
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = parsed.data;
    next();
  };
}
