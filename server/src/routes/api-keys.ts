import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hashToken } from '../lib/auth.js';
import { ACTIVITY_TYPES } from '../utils/constants.js';

const createSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Название обязательно')
    .max(50, 'Максимум 50 символов')
    .optional()
});

export const apiKeysRouter = Router();

apiKeysRouter.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      keys: keys.map((key) => ({
        id: key.id,
        label: key.label,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

apiKeysRouter.post('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const parsed = createSchema.parse(req.body);

    const rawKey = `cld_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = hashToken(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash,
        label: parsed.label ?? null
      }
    });

    await prisma.activity.create({
      data: {
        type: ACTIVITY_TYPES.API_KEY_CREATE,
        actorId: user.id,
        message: `Создан новый API-ключ${parsed.label ? ` «${parsed.label}»` : ''}`
      }
    });

    return res.status(201).json({
      key: rawKey,
      apiKey: {
        id: apiKey.id,
        label: apiKey.label,
        createdAt: apiKey.createdAt,
        lastUsedAt: apiKey.lastUsedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

apiKeysRouter.delete('/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const key = await prisma.apiKey.findFirst({
      where: { id, userId: user.id }
    });

    if (!key) {
      return res.status(404).json({ message: 'API-ключ не найден' });
    }

    await prisma.apiKey.delete({ where: { id } });

    await prisma.activity.create({
      data: {
        type: ACTIVITY_TYPES.API_KEY_DELETE,
        actorId: user.id,
        message: `Удалён API-ключ${key.label ? ` «${key.label}»` : ''}`
      }
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});
