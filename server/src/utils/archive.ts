import type archiver from 'archiver';
import type { DriveItem } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { storage } from '../services/storage.js';
import { DRIVE_ITEM_TYPES } from './constants.js';

export function sanitizeSegment(segment: string) {
  const cleaned = segment.replace(/[\\/:*?"<>|]/g, '-').trim();
  return cleaned.length > 0 ? cleaned : 'untitled';
}

export function sanitizeArchivePath(pathName: string) {
  return pathName
    .split('/')
    .map((segment) => sanitizeSegment(segment))
    .join('/');
}

export function ensureUniquePath(pathName: string, usedPaths: Set<string>) {
  let attempt = pathName;
  const isFolder = attempt.endsWith('/');
  const extensionIndex = !isFolder ? attempt.lastIndexOf('.') : -1;
  const baseName =
    extensionIndex > 0 ? attempt.slice(0, extensionIndex) : isFolder ? attempt.slice(0, -1) : attempt;
  const extension = extensionIndex > 0 ? attempt.slice(extensionIndex) : isFolder ? '/' : '';
  let counter = 1;
  while (usedPaths.has(attempt)) {
    const suffix = ` (${counter})`;
    attempt = isFolder
      ? `${baseName}${suffix}/`
      : extensionIndex > 0
      ? `${baseName}${suffix}${extension}`
      : `${baseName}${suffix}`;
    counter += 1;
  }
  usedPaths.add(attempt);
  return attempt;
}

export async function appendItemToArchive(
  archive: archiver.Archiver,
  item: DriveItem,
  ownerId: string,
  basePath: string,
  usedPaths: Set<string>
) {
  const safePath = sanitizeArchivePath(basePath);
  if (item.type === DRIVE_ITEM_TYPES.FILE) {
    if (!item.storageKey) {
      return;
    }
    const entryPath = ensureUniquePath(safePath, usedPaths);
    const stream = await storage.getFileStream(item.storageKey);
    archive.append(stream, { name: entryPath });
    return;
  }

  const folderEntry = ensureUniquePath(`${safePath}/`, usedPaths);
  archive.append('', { name: folderEntry });
  const normalizedFolderPath = folderEntry.slice(0, -1);
  const children = await prisma.driveItem.findMany({
    where: { parentId: item.id, ownerId, isTrashed: false },
    orderBy: { name: 'asc' }
  });
  for (const child of children) {
    await appendItemToArchive(archive, child, ownerId, `${normalizedFolderPath}/${child.name}`, usedPaths);
  }
}
