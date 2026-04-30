import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = error.issues.reduce<Record<string, string>>((acc, issue) => {
          const key = issue.path.join('.') || 'body';
          acc[key] = issue.message;
          return acc;
        }, {});

        next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', fields));
        return;
      }

      next(error);
    }
  };
}
