import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ACTIVITY_TYPES, DRIVE_ITEM_TYPES, SHARE_PERMISSIONS } from '../utils/constants.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { storage } from '../services/storage.js';
import { toDriveItemResponse } from '../utils/drive.js';

const shareSchema = z.object({
  permission: z.enum([SHARE_PERMISSIONS.VIEW, SHARE_PERMISSIONS.EDIT]).default(SHARE_PERMISSIONS.VIEW),
  expiresAt: z.string().datetime().optional().or(z.null())
});

export const shareApiRouter = Router();

shareApiRouter.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const links = await prisma.shareLink.findMany({
      where: { ownerId: user.id },
      include: {
        item: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({
      links: links.map((link) => ({
        id: link.id,
        token: link.token,
        url: `${config.baseUrl}/s/${link.token}`,
        permission: link.permission,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt,
        item: toDriveItemResponse(link.item)
      }))
    });
  } catch (error) {
    next(error);
  }
});

shareApiRouter.post('/:id', async (req, res, next) => {
  try {
    const parsed = shareSchema.parse(req.body);
    const { id } = req.params;
    const user = req.user!;

    const item = await prisma.driveItem.findFirst({ where: { id, ownerId: user.id } });
    if (!item) {
      return res.status(404).json({ message: 'Элемент не найден' });
    }

    if (item.isTrashed) {
      return res.status(400).json({ message: 'Нельзя делиться элементами из корзины' });
    }

    const share = await prisma.shareLink.create({
      data: {
        itemId: item.id,
        ownerId: user.id,
        permission: parsed.permission,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        token: cryptoRandomToken()
      }
    });

    await prisma.activity.create({
      data: {
        type: ACTIVITY_TYPES.SHARE_CREATE,
        actorId: user.id,
        itemId: item.id,
        message: `Создана ссылка доступа (${share.permission})`
      }
    });

    return res.status(201).json({
      link: {
        id: share.id,
        token: share.token,
        url: `${config.baseUrl}/s/${share.token}`,
        permission: share.permission,
        expiresAt: share.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
});

shareApiRouter.delete('/:shareId', async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const user = req.user!;
    const share = await prisma.shareLink.findFirst({
      where: { id: shareId, ownerId: user.id }
    });
    if (!share) {
      return res.status(404).json({ message: 'Ссылка не найдена' });
    }
    await prisma.shareLink.delete({ where: { id: share.id } });
    await prisma.activity.create({
      data: {
        type: ACTIVITY_TYPES.SHARE_DELETE,
        actorId: user.id,
        itemId: share.itemId,
        message: 'Удалена ссылка доступа'
      }
    });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export const shareRouter = Router();

shareRouter.get('/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: { item: true }
    });
    if (!link || link.item.isTrashed) {
      return res.status(404).json({ message: 'Ссылка не найдена' });
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      await prisma.shareLink.delete({ where: { id: link.id } });
      return res.status(410).json({ message: 'Ссылка истекла' });
    }

    let children: Array<ReturnType<typeof toDriveItemResponse>> = [];
    if (link.item.type === DRIVE_ITEM_TYPES.FOLDER) {
      const items = await prisma.driveItem.findMany({
        where: { parentId: link.itemId, isTrashed: false },
        orderBy: { name: 'asc' }
      });
      children = items.map(toDriveItemResponse);
    }

    return res.json({
      item: toDriveItemResponse(link.item),
      permission: link.permission,
      expiresAt: link.expiresAt,
      ownerId: link.ownerId,
      children,
      downloadUrl:
        link.item.type === DRIVE_ITEM_TYPES.FILE
          ? `${config.baseUrl}/s/${link.token}/download`
          : undefined
    });
  } catch (error) {
    next(error);
  }
});

shareRouter.get('/:token/download', async (req, res, next) => {
  try {
    const { token } = req.params;
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: { item: true }
    });
    if (!link || link.item.type !== DRIVE_ITEM_TYPES.FILE || !link.item.storageKey) {
      return res.status(404).json({ message: 'Файл не найден' });
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      await prisma.shareLink.delete({ where: { id: link.id } });
      return res.status(410).json({ message: 'Ссылка истекла' });
    }

    const stream = await storage.getFileStream(link.item.storageKey);
    res.setHeader('Content-Type', link.item.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(link.item.name)}"`);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

function cryptoRandomToken() {
  return randomBytes(16).toString('hex');
}
