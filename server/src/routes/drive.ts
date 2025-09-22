import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import archiver from 'archiver';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Prisma, DriveItem as DriveItemModel } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { storage } from '../services/storage.js';
import { toDriveItemResponse } from '../utils/drive.js';
import { ACTIVITY_TYPES, DRIVE_ITEM_TYPES } from '../utils/constants.js';
import { appendItemToArchive } from '../utils/archive.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 }
});

const listSchema = z.object({
  parentId: z.string().optional(),
  search: z.string().optional(),
  type: z.enum(['FILE', 'FOLDER']).optional(),
  trashed: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value ? value === 'true' : undefined)),
  sort: z.enum(['name', 'createdAt', 'updatedAt', 'size']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

async function buildBreadcrumbs(userId: string, parentId?: string | null) {
  if (!parentId) {
    return [] as { id: string; name: string }[];
  }
  const breadcrumbs: { id: string; name: string }[] = [];
  let currentId: string | null | undefined = parentId;
  while (currentId) {
    const parentItem: { id: string; name: string; parentId: string | null } | null =
      await prisma.driveItem.findFirst({
        where: { id: currentId, ownerId: userId },
        select: { id: true, name: true, parentId: true }
      });
    if (!parentItem) break;
    breadcrumbs.push({ id: parentItem.id, name: parentItem.name });
    currentId = parentItem.parentId;
  }
  return breadcrumbs.reverse();
}

async function toggleTrash(itemId: string, isTrashed: boolean) {
  const now = new Date();
  const stack = [itemId];
  while (stack.length) {
    const id = stack.pop();
    if (!id) continue;
    const item = await prisma.driveItem.update({
      where: { id },
      data: {
        isTrashed,
        trashedAt: isTrashed ? now : null
      }
    });
    if (item.type === DRIVE_ITEM_TYPES.FOLDER) {
      const children = await prisma.driveItem.findMany({
        where: { parentId: id }
      });
      stack.push(...children.map((child) => child.id));
    }
  }
}

async function deleteRecursive(itemId: string) {
  const item = await prisma.driveItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  if (item.type === DRIVE_ITEM_TYPES.FOLDER) {
    const children = await prisma.driveItem.findMany({ where: { parentId: itemId } });
    for (const child of children) {
      await deleteRecursive(child.id);
    }
  } else if (item.storageKey) {
    await storage.deleteFile(item.storageKey);
  }
  await prisma.shareLink.deleteMany({ where: { itemId: itemId } });
  await prisma.activity.deleteMany({ where: { itemId: itemId } });
  await prisma.driveItem.delete({ where: { id: itemId } });
}

const archiveSchema = z.object({
  ids: z.array(z.string()).min(1)
});

export const driveRouter = Router();

driveRouter.get('/list', async (req, res, next) => {
  try {
    const parsed = listSchema.parse(req.query);
    const user = req.user!;
    const isTrashed = parsed.trashed ?? false;
    const where: Prisma.DriveItemWhereInput = {
      ownerId: user.id,
      isTrashed
    };

    if (parsed.parentId !== undefined) {
      where.parentId = parsed.parentId ?? null;
    } else if (!parsed.search && !isTrashed) {
      where.parentId = null;
    }

    if (parsed.search) {
      where.name = { contains: parsed.search };
    }

    const orderBy = parsed.sort
      ? ({ [parsed.sort]: parsed.order ?? 'asc' } as Prisma.DriveItemOrderByWithRelationInput)
      : ({ updatedAt: 'desc' } satisfies Prisma.DriveItemOrderByWithRelationInput);

    const items = await prisma.driveItem.findMany({
      where,
      orderBy,
      include: { sharedLinks: true }
    });

    const breadcrumbs = await buildBreadcrumbs(user.id, parsed.parentId ?? null);

    return res.json({
      items: items.map(toDriveItemResponse),
      breadcrumbs
    });
  } catch (error) {
    next(error);
  }
});

driveRouter.post('/folder', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      parentId: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const user = req.user!;

    if (parsed.parentId) {
      const parentItem = await prisma.driveItem.findFirst({
        where: { id: parsed.parentId, ownerId: user.id }
      });
      if (!parentItem) {
        return res.status(404).json({ message: 'Родительская папка не найдена' });
      }
      if (parentItem.type !== DRIVE_ITEM_TYPES.FOLDER) {
        return res.status(400).json({ message: 'Родителем может быть только папка' });
      }
    }

    const item = await prisma.driveItem.create({
      data: {
        name: parsed.name,
        parentId: parsed.parentId ?? null,
        ownerId: user.id,
        type: DRIVE_ITEM_TYPES.FOLDER
      }
    });

    await prisma.activity.create({
      data: {
        type: ACTIVITY_TYPES.UPLOAD,
        actorId: user.id,
        itemId: item.id,
        message: `Создана папка ${item.name}`
      }
    });

    return res.status(201).json({ item: toDriveItemResponse(item) });
  } catch (error) {
    next(error);
  }
});

driveRouter.post('/file', upload.array('files'), async (req, res, next) => {
  try {
    const user = req.user!;
    const files = req.files as Express.Multer.File[];
    const parentId = req.body.parentId || null;
    if (parentId) {
      const parentItem = await prisma.driveItem.findFirst({
        where: { id: parentId, ownerId: user.id }
      });
      if (!parentItem || parentItem.type !== DRIVE_ITEM_TYPES.FOLDER) {
        return res.status(400).json({ message: 'Некорректная родительская папка' });
      }
    }

    if (!files?.length) {
      return res.status(400).json({ message: 'Файлы не переданы' });
    }

    const createdItems = [];
    for (const file of files) {
      const extension = path.extname(file.originalname);
      const key = path.posix.join(user.id, `${randomUUID()}${extension}`);
      await storage.saveFile({ buffer: file.buffer, key });

      const item = await prisma.driveItem.create({
        data: {
          name: file.originalname,
          type: DRIVE_ITEM_TYPES.FILE,
          ownerId: user.id,
          parentId,
          mimeType: file.mimetype,
          size: file.size,
          storageKey: key
        }
      });
      createdItems.push(item);

      await prisma.activity.create({
        data: {
          type: ACTIVITY_TYPES.UPLOAD,
          actorId: user.id,
          itemId: item.id,
          message: `Загружен файл ${item.name}`
        }
      });
    }

    return res.status(201).json({ items: createdItems.map(toDriveItemResponse) });
  } catch (error) {
    next(error);
  }
});

driveRouter.post('/archive', async (req, res, next) => {
  try {
    const { ids } = archiveSchema.parse(req.body);
    const user = req.user!;

    const items = await prisma.driveItem.findMany({
      where: {
        ownerId: user.id,
        id: { in: ids },
        isTrashed: false
      }
    });

    if (!items.length) {
      return res.status(404).json({ message: 'Элементы не найдены' });
    }

    res.setHeader('Content-Type', 'application/zip');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="CloudDrive-${timestamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => {
      next(error);
    });
    archive.pipe(res);

    const itemsById = new Map(items.map((item) => [item.id, item]));
    const orderedItems = ids
      .map((id) => itemsById.get(id))
      .filter((entry): entry is DriveItemModel => Boolean(entry));

    const usedPaths = new Set<string>();
    for (const item of orderedItems) {
      await appendItemToArchive(archive, item, user.id, item.name, usedPaths);
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

driveRouter.patch('/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      parentId: z.string().nullable().optional()
    });
    const parsed = schema.parse(req.body);
    const { id } = req.params;
    const user = req.user!;

    const item = await prisma.driveItem.findFirst({
      where: { id, ownerId: user.id }
    });
    if (!item) {
      return res.status(404).json({ message: 'Элемент не найден' });
    }

    if (parsed.parentId) {
      if (parsed.parentId === item.id) {
        return res.status(400).json({ message: 'Нельзя переместить элемент в себя' });
      }
      const parentItem = await prisma.driveItem.findFirst({
        where: { id: parsed.parentId, ownerId: user.id }
      });
      if (!parentItem || parentItem.type !== DRIVE_ITEM_TYPES.FOLDER) {
        return res.status(400).json({ message: 'Некорректная папка назначения' });
      }
    }

    const updated = await prisma.driveItem.update({
      where: { id: item.id },
      data: {
        name: parsed.name ?? item.name,
        parentId: parsed.parentId ?? item.parentId
      }
    });

    if (parsed.name && parsed.name !== item.name) {
      await prisma.activity.create({
        data: {
          type: ACTIVITY_TYPES.RENAME,
          actorId: user.id,
          itemId: item.id,
          message: `Переименовано в ${parsed.name}`
        }
      });
    }

    if (parsed.parentId !== undefined && parsed.parentId !== item.parentId) {
      await prisma.activity.create({
        data: {
          type: ACTIVITY_TYPES.MOVE,
          actorId: user.id,
          itemId: item.id,
          message: `Перемещено в новую папку`
        }
      });
    }

    return res.json({ item: toDriveItemResponse(updated) });
  } catch (error) {
    next(error);
  }
});

driveRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const hard = req.query.hard === 'true';
    const user = req.user!;

    const item = await prisma.driveItem.findFirst({ where: { id, ownerId: user.id } });
    if (!item) {
      return res.status(404).json({ message: 'Элемент не найден' });
    }

    if (hard) {
      await deleteRecursive(id);
    } else {
      await toggleTrash(id, true);
      await prisma.activity.create({
        data: {
          type: ACTIVITY_TYPES.DELETE,
          actorId: user.id,
          itemId: id,
          message: `Перемещено в корзину: ${item.name}`
        }
      });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

driveRouter.post('/:id/restore', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const item = await prisma.driveItem.findFirst({ where: { id, ownerId: user.id } });
    if (!item) {
      return res.status(404).json({ message: 'Элемент не найден' });
    }

    await toggleTrash(id, false);
    await prisma.activity.create({
      data: {
        type: ACTIVITY_TYPES.RESTORE,
        actorId: user.id,
        itemId: id,
        message: `Восстановлено: ${item.name}`
      }
    });

    return res.status(200).json({ message: 'Восстановлено' });
  } catch (error) {
    next(error);
  }
});

driveRouter.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const item = await prisma.driveItem.findFirst({ where: { id, ownerId: user.id } });
    if (!item || item.type !== DRIVE_ITEM_TYPES.FILE || !item.storageKey) {
      return res.status(404).json({ message: 'Файл не найден' });
    }

    const stream = await storage.getFileStream(item.storageKey);
    res.setHeader('Content-Type', item.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name)}"`);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});
