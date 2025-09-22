import clsx from 'clsx';
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';

export interface UploadItemState {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  loadedBytes?: number;
  totalBytes?: number;
}

interface UploadProgressListProps {
  uploads: UploadItemState[];
}

export function UploadProgressList({ uploads }: UploadProgressListProps) {
  if (!uploads.length) {
    return null;
  }

  const formatMegabytes = (bytes?: number) => {
    if (typeof bytes !== 'number' || Number.isNaN(bytes)) {
      return '—';
    }
    return (bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Загрузка файлов</p>
      <div className="space-y-3">
        {uploads.map((upload) => (
          <div key={upload.id} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
              <span className="line-clamp-1 font-medium text-slate-600 dark:text-slate-300">{upload.name}</span>
              <span className="tabular-nums text-slate-400">{Math.round(upload.progress)}%</span>
            </div>
            <div className="text-[11px] text-slate-400 sm:text-xs">
              {formatMegabytes(upload.loadedBytes)} / {formatMegabytes(upload.totalBytes)} МБ
            </div>
            <div className="flex items-center gap-2">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={clsx('h-full rounded-full transition-all', {
                    'bg-primary-500': upload.status === 'uploading' || upload.status === 'success',
                    'bg-rose-500': upload.status === 'error'
                  })}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              {upload.status === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : upload.status === 'error' ? (
                <CircleAlert className="h-4 w-4 text-rose-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
