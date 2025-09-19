export const DRIVE_ITEM_TYPES = {
  FILE: 'FILE',
  FOLDER: 'FOLDER'
} as const;

export type DriveItemType = (typeof DRIVE_ITEM_TYPES)[keyof typeof DRIVE_ITEM_TYPES];

export const SHARE_PERMISSIONS = {
  VIEW: 'VIEW',
  EDIT: 'EDIT'
} as const;

export type SharePermission = (typeof SHARE_PERMISSIONS)[keyof typeof SHARE_PERMISSIONS];

export const ACTIVITY_TYPES = {
  UPLOAD: 'UPLOAD',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
  SHARE_CREATE: 'SHARE_CREATE',
  SHARE_DELETE: 'SHARE_DELETE',
  RENAME: 'RENAME',
  MOVE: 'MOVE'
} as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];
