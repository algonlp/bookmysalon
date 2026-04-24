import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../../shared/errors/httpError';
import { logger } from '../../shared/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid request' });
    return;
  }

  logger.error('Unhandled request error', {
    message: err.message,
    stack: err.stack,
    path: _req.originalUrl,
    method: _req.method
  });
  res.status(500).json({ error: 'Internal server error' });
};
