import { Plus, Upload } from 'lucide-react';
import { Button } from './ui/Button';

interface MobileQuickActionsProps {
  onCreateFolder: () => void;
  onUploadClick: () => void;
  isUploading: boolean;
}

export function MobileQuickActions({ onCreateFolder, onUploadClick, isUploading }: MobileQuickActionsProps) {
  return (
    <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 lg:hidden">
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={onCreateFolder}
        >
          <Plus className="h-5 w-5" />
          Папка
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={onUploadClick}
          disabled={isUploading}
        >
          <Upload className="h-5 w-5" />
          {isUploading ? 'Загрузка…' : 'Файлы'}
        </Button>
      </div>
    </div>
  );
}
