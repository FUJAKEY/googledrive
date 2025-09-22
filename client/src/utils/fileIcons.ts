import {
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
  FileType,
  File as FileIcon
} from 'lucide-react';
import type { DriveItem } from '../types';

export function resolveFileIcon(item: DriveItem) {
  if (item.type === 'FOLDER') return FileType;
  const mime = item.mimeType ?? '';
  if (mime.includes('image')) return FileImage;
  if (mime.includes('pdf')) return FileText;
  if (mime.includes('audio')) return FileAudio;
  if (mime.includes('video')) return FileVideo;
  if (mime.includes('zip') || mime.includes('rar')) return FileArchive;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet;
  if (mime.includes('text') || mime.includes('markdown')) return FileText;
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('typescript')) return FileCode;
  return FileIcon;
}

export function formatSize(bytes?: number | null) {
  if (!bytes) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
