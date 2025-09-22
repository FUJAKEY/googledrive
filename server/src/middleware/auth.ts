import type { NextFunction, Request, Response } from 'express';
import { tokenUtils, hashToken } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

const API_KEY_HEADER = 'x-api-key';
const API_KEY_PREFIX = 'ApiKey ';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKeyValue = extractApiKey(req);
    if (apiKeyValue) {
      const keyHash = hashToken(apiKeyValue);
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { user: true }
      });

      if (!apiKey) {
        return res.status(401).json({ message: 'Недействительный API-ключ' });
      }

      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() }
      });

      req.user = apiKey.user;
      req.apiKey = {
        id: apiKey.id,
        label: apiKey.label ?? undefined
      };
      return next();
    }

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
  } catch (error) {
    const message =
      (error as { name?: string }).name === 'JsonWebTokenError'
        ? 'Недействительный токен'
        : 'Не удалось авторизоваться';
    return res.status(401).json({ message });
  }
}

function extractApiKey(req: Request) {
  const headerValue = req.header(API_KEY_HEADER) ?? undefined;
  if (headerValue?.trim()) {
    return headerValue.trim();
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith(API_KEY_PREFIX)) {
    return authHeader.slice(API_KEY_PREFIX.length).trim();
  }

  return undefined;
}
