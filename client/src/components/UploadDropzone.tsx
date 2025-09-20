import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import clsx from 'clsx';
import { CloudUpload } from 'lucide-react';

export function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length) {
        onFiles(acceptedFiles);
      }
    },
    [onFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'mt-4 flex h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white text-center transition hover:border-primary-400 dark:border-slate-700 dark:bg-slate-900',
        isDragActive && 'border-primary-500 bg-primary-500/5'
      )}
    >
      <input {...getInputProps()} />
      <CloudUpload className="h-10 w-10 text-primary-500" />
      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
        Перетащите файлы сюда или используйте кнопку «Загрузить»
      </p>
      <p className="mt-1 text-xs text-slate-400">Поддерживаются множественные загрузки</p>
    </div>
  );
}
