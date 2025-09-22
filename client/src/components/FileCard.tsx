import clsx from 'clsx';
import { Share2 } from 'lucide-react';
import type { DriveItem } from '../types';
import { resolveFileIcon, formatSize } from '../utils/fileIcons';

interface FileCardProps {
  item: DriveItem;
  isSelected: boolean;
  onSelect: (item: DriveItem) => void;
  onOpen: (item: DriveItem) => void;
}

export function FileCard({ item, isSelected, onSelect, onOpen }: FileCardProps) {
  const Icon = resolveFileIcon(item);

  return (
    <button
      onClick={() => onSelect(item)}
      onDoubleClick={() => onOpen(item)}
      className={clsx(
        'group flex h-36 w-full flex-col justify-between rounded-2xl border border-transparent bg-white p-4 text-left shadow-soft transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg dark:bg-slate-900',
        isSelected && 'border-primary-400 ring-2 ring-primary-200'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
          <Icon className="h-6 w-6" />
        </div>
        {item.shareLinks?.length ? (
          <span className="rounded-full bg-primary-500/10 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-300">
            <Share2 className="mr-1 inline h-4 w-4" /> {item.shareLinks.length}
          </span>
        ) : null}
      </div>
      <div>
        <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {item.name}
        </p>
        <p className="mt-1 text-xs text-slate-400">{item.type === 'FILE' ? formatSize(item.size ?? undefined) : 'Папка'}</p>
      </div>
    </button>
  );
}
