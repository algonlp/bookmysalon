import type { Request, Response } from 'express';

export const healthController = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    service: 'algonlp-fresha',
    timestamp: new Date().toISOString()
  });
};
