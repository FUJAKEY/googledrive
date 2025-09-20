import type { NextFunction, Request, Response } from 'express';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(error);
  }

  const status = (error as { status?: number }).status ?? 500;
  const message = (error as { message?: string }).message ?? 'Внутренняя ошибка сервера';

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ message });
}
