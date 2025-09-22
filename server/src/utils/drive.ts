import type { Activity, DriveItem, ShareLink } from '@prisma/client';

export interface DriveItemResponse {
  id: string;
  name: string;
  type: DriveItem['type'];
  mimeType?: string | null;
  size?: number | null;
  parentId?: string | null;
  isTrashed: boolean;
  trashedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  shareLinks?: ShareLink[];
}

export function toDriveItemResponse(
  item: DriveItem & { sharedLinks?: ShareLink[] | null }
): DriveItemResponse {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    mimeType: item.mimeType,
    size: item.size,
    parentId: item.parentId,
    isTrashed: item.isTrashed,
    trashedAt: item.trashedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    shareLinks: item.sharedLinks ?? undefined
  };
}

export function toActivityResponse(activity: Activity) {
  return {
    id: activity.id,
    type: activity.type,
    itemId: activity.itemId,
    actorId: activity.actorId,
    message: activity.message,
    createdAt: activity.createdAt
  };
}
