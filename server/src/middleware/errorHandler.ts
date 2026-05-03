import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../di/types.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.fields && { fields: err.fields }),
        },
      });
      return;
    }

    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  };
}

export const errorHandler = createErrorHandler({
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
});
