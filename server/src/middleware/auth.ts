import type { NextFunction, Request, Response } from 'express';
import { tokenUtils } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Требуется авторизация' });
    }
    const token = authHeader.slice(7);
    const payload = tokenUtils.verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Недействительный токен' });
  }
}
