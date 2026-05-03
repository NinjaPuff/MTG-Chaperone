import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, createErrorHandler } from '../../middleware/errorHandler.js';

describe('errorHandler', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const errorHandler = createErrorHandler(logger);
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Parameters<typeof errorHandler>[2];

  beforeEach(() => {
    json.mockReset();
    status.mockClear();
    logger.error.mockReset();
  });

  it('formats AppError responses', () => {
    errorHandler(
      new AppError(404, 'NOT_FOUND', 'Missing thing'),
      {} as never,
      res,
      {} as never,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Missing thing',
      },
    });
  });

  it('returns generic 500 for unknown errors', () => {
    const err = new Error('boom');
    errorHandler(err, {} as never, res, {} as never);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(logger.error).toHaveBeenCalledWith('Unhandled error:', err);
  });
});
