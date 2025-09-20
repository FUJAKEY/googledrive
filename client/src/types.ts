export type DriveItemType = 'FILE' | 'FOLDER';

export type SharePermission = 'VIEW' | 'EDIT';

export interface ShareLink {
  id: string;
  token: string;
  url: string;
  permission: SharePermission;
  expiresAt?: string | null;
  createdAt?: string;
  item?: DriveItem;
}

export interface DriveItem {
  id: string;
  name: string;
  type: DriveItemType;
  mimeType?: string | null;
  size?: number | null;
  parentId?: string | null;
  isTrashed: boolean;
  trashedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  shareLinks?: ShareLink[];
}

export interface ShareAccessResponse {
  item: DriveItem;
  permission: SharePermission;
  expiresAt?: string | null;
  ownerId: string;
  children?: DriveItem[];
  downloadUrl?: string;
  archiveUrl?: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface DriveListResponse {
  items: DriveItem[];
  breadcrumbs: BreadcrumbItem[];
}

export interface ActivityItem {
  id: string;
  type: 'UPLOAD' | 'DELETE' | 'RESTORE' | 'SHARE_CREATE' | 'SHARE_DELETE' | 'RENAME' | 'MOVE';
  itemId?: string | null;
  actorId?: string | null;
  message: string;
  createdAt: string;
}
