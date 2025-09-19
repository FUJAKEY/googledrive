import clsx from 'clsx';
import { Share2 } from 'lucide-react';
import type { DriveItem } from '../types';
import { resolveFileIcon, formatSize } from '../utils/fileIcons';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface FileRowProps {
  item: DriveItem;
  isSelected: boolean;
  onSelect: (item: DriveItem) => void;
  onOpen: (item: DriveItem) => void;
}

export function FileRow({ item, isSelected, onSelect, onOpen }: FileRowProps) {
  const Icon = resolveFileIcon(item);

  return (
    <div
      className={clsx(
        'group grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-xl border border-transparent bg-white px-4 py-3 text-sm shadow-sm transition hover:border-primary-200 hover:shadow-md dark:bg-slate-900',
        isSelected && 'border-primary-400 ring-2 ring-primary-200'
      )}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onOpen(item)}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">{item.name}</p>
          <p className="text-xs text-slate-400">
            {item.type === 'FILE' ? formatSize(item.size ?? undefined) : 'Папка'}
          </p>
        </div>
      </div>
      <div className="text-slate-400">
        {format(new Date(item.updatedAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
      </div>
      <div className="justify-self-end text-xs text-slate-400">
        {item.shareLinks?.length ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2 py-1 text-primary-600 dark:text-primary-300">
            <Share2 className="h-4 w-4" /> {item.shareLinks.length}
          </span>
        ) : (
          '—'
        )}
      </div>
      <div className="justify-self-end text-xs uppercase tracking-wide text-slate-400">
        {item.type === 'FILE' ? 'Файл' : 'Папка'}
      </div>
    </div>
  );
}
