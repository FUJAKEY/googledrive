import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Recycle, Grid, View } from 'lucide-react';
import toast from 'react-hot-toast';
import { Topbar } from '../components/Topbar';
import { ApiKeysModal } from '../components/ApiKeysModal';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import type { DriveItem, DriveListResponse } from '../types';
import { SelectionBar } from '../components/SelectionBar';
import { FileCard } from '../components/FileCard';
import { FileRow } from '../components/FileRow';
import { Skeleton } from '../components/ui/Skeleton';

export function TrashPage() {
  const { authorizedFetch } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedItems, setSelectedItems] = useState<DriveItem[]>([]);
  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);

  const { data, isLoading } = useQuery<DriveListResponse>({
    queryKey: ['trash', search],
    queryFn: () =>
      authorizedFetch(
        `/api/drive/list?trashed=true${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ),
    placeholderData: keepPreviousData
  });

  const items: DriveItem[] = data?.items ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['trash'] });
    void queryClient.invalidateQueries({ queryKey: ['drive'] });
    void queryClient.invalidateQueries({ queryKey: ['activity'] });
  };

  const toggleSelect = (item: DriveItem) => {
    setSelectedItems((prev) =>
      prev.some((entry) => entry.id === item.id)
        ? prev.filter((entry) => entry.id !== item.id)
        : [...prev, item]
    );
  };

  const resetSelection = () => setSelectedItems([]);

  const handleRestore = async () => {
    await Promise.all(
      selectedItems.map((item) =>
        authorizedFetch(`/api/drive/${item.id}/restore`, { method: 'POST' })
      )
    );
    toast.success('Восстановлено');
    resetSelection();
    refresh();
  };

  const handleDelete = async () => {
    await Promise.all(
      selectedItems.map((item) =>
        authorizedFetch(`/api/drive/${item.id}?hard=true`, { method: 'DELETE' })
      )
    );
    toast.success('Удалено навсегда');
    resetSelection();
    refresh();
  };

  useEffect(() => {
    if (!items.length) {
      resetSelection();
    }
  }, [items.length]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          Корзина пуста
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <FileCard
              key={item.id}
              item={item}
              isSelected={selectedItems.some((entry) => entry.id === item.id)}
              onSelect={toggleSelect}
              onOpen={() => undefined}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            isSelected={selectedItems.some((entry) => entry.id === item.id)}
            onSelect={toggleSelect}
            onOpen={() => undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Topbar
        search={search}
        onSearchChange={setSearch}
        onToggleTheme={toggleTheme}
        theme={theme}
        onOpenApiKeys={() => setIsApiKeysOpen(true)}
        actions={
          <div className="hidden items-center gap-2 lg:flex">
            <button
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${viewMode === 'grid' ? 'border-primary-300 bg-primary-500/10 text-primary-600' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" /> Плитка
            </button>
            <button
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${viewMode === 'list' ? 'border-primary-300 bg-primary-500/10 text-primary-600' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300'}`}
              onClick={() => setViewMode('list')}
            >
              <View className="h-4 w-4" /> Список
            </button>
          </div>
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-32 pt-6 sm:px-8 lg:px-12">
        <div className="rounded-3xl bg-white p-6 shadow-soft dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500">
            <Recycle className="h-5 w-5 text-primary-500" />
            <span>Корзина</span>
          </div>
          {selectedItems.length > 0 && (
            <SelectionBar
              count={selectedItems.length}
              onClear={resetSelection}
              onDelete={() => void handleDelete()}
              onDownload={() => undefined}
              onDownloadZip={() => undefined}
              onShare={() => undefined}
              onMove={() => undefined}
              onRename={() => undefined}
              onRestore={() => void handleRestore()}
              isTrashView
              canDownload={false}
              canDownloadZip={false}
              canShare={false}
              canMove={false}
              canRename={false}
            />
          )}
          <div className="mt-6">{renderContent()}</div>
        </div>
      </div>
      <ApiKeysModal isOpen={isApiKeysOpen} onClose={() => setIsApiKeysOpen(false)} />
    </div>
  );
}
