import { Button } from './ui/Button';
import { Download, Share2, Trash2, FolderUp, RotateCcw, Pencil, Archive } from 'lucide-react';

interface SelectionBarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDownloadZip: () => void;
  onShare: () => void;
  onMove: () => void;
  onRename: () => void;
  onRestore: () => void;
  isTrashView?: boolean;
  canDownload?: boolean;
  canDownloadZip?: boolean;
  canShare?: boolean;
  canMove?: boolean;
  canRename?: boolean;
}

export function SelectionBar({
  count,
  onClear,
  onDelete,
  onDownload,
  onDownloadZip,
  onShare,
  onMove,
  onRename,
  onRestore,
  isTrashView = false,
  canDownload = true,
  canDownloadZip = true,
  canShare = true,
  canMove = true,
  canRename = true
}: SelectionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-200 bg-primary-500/10 px-4 py-3 text-sm text-primary-600 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-200">
      <span>
        Выбрано: <strong>{count}</strong>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {!isTrashView && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onDownload} disabled={!canDownload}>
                <Download className="h-4 w-4" /> Скачать
              </Button>
              <Button variant="secondary" size="sm" onClick={onDownloadZip} disabled={!canDownloadZip}>
                <Archive className="h-4 w-4" /> ZIP
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={onShare} disabled={!canShare}>
              <Share2 className="h-4 w-4" /> Поделиться
            </Button>
            <Button variant="secondary" size="sm" onClick={onMove} disabled={!canMove}>
              <FolderUp className="h-4 w-4" /> Переместить
            </Button>
            <Button variant="secondary" size="sm" onClick={onRename} disabled={!canRename}>
              <Pencil className="h-4 w-4" /> Переименовать
            </Button>
          </>
        )}
        {isTrashView ? (
          <Button variant="secondary" size="sm" onClick={onRestore}>
            <RotateCcw className="h-4 w-4" /> Восстановить
          </Button>
        ) : (
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Удалить
          </Button>
        )}
        {isTrashView && (
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Удалить навсегда
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Снять выделение
        </Button>
      </div>
    </div>
  );
}
