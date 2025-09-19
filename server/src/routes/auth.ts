import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { constants } from '../config.js';
import { sanitizeUser, tokenUtils, hashToken } from '../lib/auth.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Некорректные данные', issues: result.error.flatten() });
    }

    const existing = await prisma.user.findUnique({ where: { email: result.data.email } });
    if (existing) {
      return res.status(409).json({ message: 'Пользователь уже существует' });
    }

    const hashed = await bcrypt.hash(result.data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: result.data.email,
        password: hashed,
        name: result.data.name
      }
    });

    const { token, tokenHash, expiresAt } = tokenUtils.generateRefreshToken();
    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt
      }
    });

    const accessToken = tokenUtils.createAccessToken(user);
    res.cookie(constants.refreshCookieName, token, {
      ...constants.refreshCookieOptions,
      expires: expiresAt
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      accessToken
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Некорректные данные', issues: result.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { email: result.data.email } });
    if (!user) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const isValid = await bcrypt.compare(result.data.password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const { token, tokenHash, expiresAt } = tokenUtils.generateRefreshToken();
    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt
      }
    });

    const accessToken = tokenUtils.createAccessToken(user);
    res.cookie(constants.refreshCookieName, token, {
      ...constants.refreshCookieOptions,
      expires: expiresAt
    });

    return res.json({
      user: sanitizeUser(user),
      accessToken
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[constants.refreshCookieName];
    if (!refreshToken) {
      return res.status(401).json({ message: 'Токен обновления отсутствует' });
    }

    const tokenHashValue = hashToken(refreshToken);
    const session = await prisma.session.findUnique({ where: { tokenHash: tokenHashValue } });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Сессия истекла' });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }

    const { token, tokenHash, expiresAt } = tokenUtils.generateRefreshToken();
    await prisma.session.update({
      where: { tokenHash: tokenHashValue },
      data: { tokenHash, expiresAt }
    });

    const accessToken = tokenUtils.createAccessToken(user);
    res.cookie(constants.refreshCookieName, token, {
      ...constants.refreshCookieOptions,
      expires: expiresAt
    });

    return res.json({
      user: sanitizeUser(user),
      accessToken
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[constants.refreshCookieName];
    if (refreshToken) {
      const tokenHashValue = hashToken(refreshToken);
      await prisma.session.deleteMany({ where: { tokenHash: tokenHashValue } });
    }
    res.clearCookie(constants.refreshCookieName, constants.refreshCookieOptions);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});
