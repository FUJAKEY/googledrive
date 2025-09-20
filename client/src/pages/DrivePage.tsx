import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { View, Grid, Plus, Upload, FolderUp, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { UploadDropzone } from '../components/UploadDropzone';
import { FileCard } from '../components/FileCard';
import { FileRow } from '../components/FileRow';
import { SelectionBar } from '../components/SelectionBar';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { PreviewModal, type PreviewData } from '../components/PreviewModal';
import { MobileQuickActions } from '../components/MobileQuickActions';
import { UploadProgressList, type UploadItemState } from '../components/UploadProgressList';
import type { DriveItem, DriveListResponse, ShareLink, SharePermission } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

type SortField = 'name' | 'updatedAt' | 'createdAt' | 'size';

type ViewMode = 'grid' | 'list';

export function DrivePage() {
  const queryClient = useQueryClient();
  const { authorizedFetch, accessToken, refresh } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedItems, setSelectedItems] = useState<DriveItem[]>([]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [sharePermission, setSharePermission] = useState<SharePermission>('VIEW');
  const [shareExpiration, setShareExpiration] = useState<string>('');
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [moveFolders, setMoveFolders] = useState<DriveItem[]>([]);
  const [moveBreadcrumbs, setMoveBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItemState[]>([]);

  const isUploading = uploadQueue.some((item) => item.status === 'uploading' || item.status === 'pending');

  const triggerDesktopUpload = useCallback(() => {
    if (typeof document === 'undefined') return;
    const element = document.getElementById('upload-hidden') as HTMLInputElement | null;
    element?.click();
  }, []);

  const triggerMobileUpload = useCallback(() => {
    if (typeof document === 'undefined') return;
    const element = document.getElementById('upload-hidden-mobile') as HTMLInputElement | null;
    element?.click();
  }, []);

  const registerUploadItem = useCallback((file: File) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry: UploadItemState = {
      id,
      name: file.name,
      progress: 0,
      status: 'pending'
    };
    setUploadQueue((prev) => [...prev.filter((item) => item.status !== 'success'), entry]);
    return id;
  }, []);

  const updateUploadItem = useCallback((id: string, patch: Partial<UploadItemState>) => {
    setUploadQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const scheduleUploadCleanup = useCallback((id: string) => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      setUploadQueue((prev) => prev.filter((item) => !(item.id === id && item.status === 'success')));
    }, 2500);
  }, []);

  const { data, isLoading } = useQuery<DriveListResponse>({
    queryKey: ['drive', { parentId: currentFolderId, search, sortField, sortOrder }],
    queryFn: () =>
      authorizedFetch(
        `/api/drive/list?${new URLSearchParams({
          ...(currentFolderId ? { parentId: currentFolderId } : {}),
          ...(search ? { search } : {}),
          sort: sortField,
          order: sortOrder
        }).toString()}`
      ),
    placeholderData: keepPreviousData
  });

  const refreshDrive = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['drive'] });
    void queryClient.invalidateQueries({ queryKey: ['activity'] });
  }, [queryClient]);

  const resetSelection = () => setSelectedItems([]);

  const toggleSelect = (item: DriveItem) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const handleOpenItem = (item: DriveItem) => {
    if (item.type === 'FOLDER') {
      setCurrentFolderId(item.id);
      resetSelection();
    } else {
      void openPreview(item);
    }
  };

  const openPreview = async (item: DriveItem) => {
    setPreviewItem(item);
    setPreviewData(null);
    try {
      if (item.mimeType?.includes('image')) {
        const blob = await fetchFile(item.id);
        const url = URL.createObjectURL(blob);
        setPreviewData({ type: 'image', url });
      } else if (item.mimeType?.includes('pdf')) {
        const blob = await fetchFile(item.id);
        const url = URL.createObjectURL(blob);
        setPreviewData({ type: 'pdf', url });
      } else if (item.mimeType?.includes('text') || item.mimeType?.includes('json') || item.mimeType?.includes('markdown')) {
        const text = await fetchText(item.id);
        setPreviewData({ type: 'text', content: text });
      } else {
        setPreviewData({ type: 'unknown' });
      }
    } catch {
      toast.error('Не удалось загрузить предпросмотр');
      setPreviewData({ type: 'unknown' });
    }
  };

  useEffect(() => {
    return () => {
      if (previewData?.url) {
        URL.revokeObjectURL(previewData.url);
      }
    };
  }, [previewData]);

  const fetchFile = async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/api/drive/${id}/download`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error('download_failed');
    }
    return response.blob();
  };

  const fetchText = async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/api/drive/${id}/download`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      credentials: 'include'
    });
    if (!response.ok) throw new Error('download_failed');
    return response.text();
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    await authorizedFetch('/api/drive/folder', {
      method: 'POST',
      body: JSON.stringify({ name: folderName, parentId: currentFolderId ?? undefined })
    });
    setFolderName('');
    setIsCreateFolderOpen(false);
    refreshDrive();
    toast.success('Папка создана');
  };

  const handleUpload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      let hadErrors = false;
      const parentId = currentFolderId;
      const endpoint = `${API_BASE_URL}/api/drive/file`;

      const uploadSingle = async (file: File) => {
        const uploadId = registerUploadItem(file);
        updateUploadItem(uploadId, { status: 'uploading', progress: 1 });

        const buildFormData = () => {
          const formData = new FormData();
          formData.append('files', file);
          if (parentId) {
            formData.append('parentId', parentId);
          }
          return formData;
        };

        const attempt = (token?: string | null) =>
          new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', endpoint);
            xhr.withCredentials = true;
            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const progress = Math.max(5, Math.round((event.loaded / event.total) * 100));
                updateUploadItem(uploadId, { status: 'uploading', progress });
              } else {
                updateUploadItem(uploadId, { status: 'uploading' });
              }
            };
            xhr.onerror = () => {
              updateUploadItem(uploadId, { status: 'error', progress: 0 });
              reject(new Error('network'));
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                updateUploadItem(uploadId, { status: 'success', progress: 100 });
                scheduleUploadCleanup(uploadId);
                resolve();
              } else if (xhr.status === 401) {
                reject(new Error('unauthorized'));
              } else {
                updateUploadItem(uploadId, { status: 'error' });
                reject(new Error('failed'));
              }
            };
            xhr.send(buildFormData());
          });

        const initialToken = accessToken;
        try {
          await attempt(initialToken);
        } catch (error) {
          if ((error as Error).message === 'unauthorized') {
            try {
              await refresh();
              const latestToken = window.localStorage.getItem('clouddrive.accessToken');
              await attempt(latestToken);
            } catch (retryError) {
              hadErrors = true;
              updateUploadItem(uploadId, { status: 'error' });
              throw retryError;
            }
          } else {
            hadErrors = true;
            throw error;
          }
        }
      };

      for (const file of files) {
        try {
          await uploadSingle(file);
        } catch {
          // continue uploading оставшиеся файлы
        }
      }

      refreshDrive();
      if (hadErrors) {
        toast.error('Некоторые файлы не удалось загрузить');
      } else {
        toast.success('Все файлы загружены');
      }
    },
    [accessToken, currentFolderId, refresh, refreshDrive, registerUploadItem, scheduleUploadCleanup, updateUploadItem]
  );

  const handleDelete = async (permanent = false) => {
    await Promise.all(
      selectedItems.map((item) =>
        authorizedFetch(`/api/drive/${item.id}${permanent ? '?hard=true' : ''}`, {
          method: 'DELETE'
        })
      )
    );
    toast.success(permanent ? 'Удалено навсегда' : 'Перемещено в корзину');
    resetSelection();
    refreshDrive();
  };

  const handleRestore = async () => {
    await Promise.all(
      selectedItems.map((item) =>
        authorizedFetch(`/api/drive/${item.id}/restore`, {
          method: 'POST'
        })
      )
    );
    toast.success('Элементы восстановлены');
    resetSelection();
    refreshDrive();
  };

  const handleDownload = async () => {
    for (const item of selectedItems.filter((entry) => entry.type === 'FILE')) {
      const blob = await fetchFile(item.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadZip = async () => {
    if (!selectedItems.length) return;
    try {
      let token = accessToken ?? window.localStorage.getItem('clouddrive.accessToken');
      if (!token) {
        await refresh();
        token = window.localStorage.getItem('clouddrive.accessToken');
      }
      if (!token) {
        toast.error('Авторизуйтесь, чтобы скачать архив');
        return;
      }

      const execute = async (authToken: string) =>
        fetch(`${API_BASE_URL}/api/drive/archive`, {
          method: 'POST',
          headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ ids: selectedItems.map((item) => item.id) })
        });

      let response = await execute(token);
      if (response.status === 401) {
        await refresh();
        const retryToken = window.localStorage.getItem('clouddrive.accessToken');
        if (retryToken) {
          response = await execute(retryToken);
        }
      }

      if (!response.ok) {
        throw new Error('archive_failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
      link.href = url;
      link.download = `CloudDrive-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('ZIP-архив сформирован');
    } catch {
      toast.error('Не удалось подготовить архив');
    }
  };

  const handleRename = async () => {
    const item = selectedItems[0];
    if (!item) return;
    await authorizedFetch(`/api/drive/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: renameValue })
    });
    toast.success('Название обновлено');
    setIsRenameOpen(false);
    resetSelection();
    refreshDrive();
  };

  const openMoveModal = async (target?: string | null) => {
    const parent = target ?? null;
    const response = await authorizedFetch<DriveListResponse>(
      `/api/drive/list?type=FOLDER${parent ? `&parentId=${parent}` : ''}`
    );
    setMoveFolders(response.items.filter((folder) => !selectedItems.some((item) => item.id === folder.id)));
    setMoveBreadcrumbs(response.breadcrumbs);
    setMoveTarget(parent);
    setIsMoveOpen(true);
  };

  const handleMove = async () => {
    await Promise.all(
      selectedItems.map((item) =>
        authorizedFetch(`/api/drive/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ parentId: moveTarget })
        })
      )
    );
    toast.success('Элементы перемещены');
    setIsMoveOpen(false);
    resetSelection();
    refreshDrive();
  };

  const handleShare = async () => {
    const item = selectedItems[0];
    if (!item) return;
    const payload = await authorizedFetch<{ link: ShareLink }>(`/api/share/${item.id}`, {
      method: 'POST',
      body: JSON.stringify({
        permission: sharePermission,
        expiresAt: shareExpiration ? new Date(shareExpiration).toISOString() : null
      })
    });
    navigator.clipboard
      .writeText(payload.link.url)
      .then(() => toast.success('Ссылка скопирована в буфер обмена'))
      .catch(() => toast.success('Ссылка создана'));
    setIsShareOpen(false);
    resetSelection();
    refreshDrive();
  };

  const selectedIsInTrash = useMemo(() => selectedItems.some((item) => item.isTrashed), [selectedItems]);

  const currentItems: DriveItem[] = data?.items ?? [];

  const breadcrumbs = data?.breadcrumbs ?? [];

  useEffect(() => {
    if (selectedItems.length === 1) {
      setRenameValue(selectedItems[0].name);
    }
  }, [selectedItems]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      );
    }

    if (!currentItems.length) {
      return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Папка пустая</p>
          <p className="mt-2 text-sm text-slate-400">
            Создайте новую папку или загрузите файлы с помощью кнопки «Загрузить».
          </p>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {currentItems.map((item) => (
            <FileCard
              key={item.id}
              item={item}
              isSelected={selectedItems.some((selected) => selected.id === item.id)}
              onSelect={toggleSelect}
              onOpen={handleOpenItem}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {currentItems.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            isSelected={selectedItems.some((selected) => selected.id === item.id)}
            onSelect={toggleSelect}
            onOpen={handleOpenItem}
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
        actions={
          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateFolderOpen(true)}>
              <Plus className="h-4 w-4" /> Новая папка
            </Button>
            <Button variant="primary" size="sm" onClick={triggerDesktopUpload} disabled={isUploading}>
              <Upload className="h-4 w-4" /> {isUploading ? 'Загрузка...' : 'Загрузить'}
            </Button>
            <input
              id="upload-hidden"
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  void handleUpload(Array.from(event.target.files));
                  event.target.value = '';
                }
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
              }}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-32 pt-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-soft dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Breadcrumbs
            items={breadcrumbs}
            currentFolderId={currentFolderId}
            onNavigate={(folderId) => {
              setCurrentFolderId(folderId);
              resetSelection();
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <View className="h-4 w-4" />
            </Button>
            <select
              value={sortField}
              onChange={(event) => setSortField(event.target.value as SortField)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="updatedAt">По обновлению</option>
              <option value="createdAt">По дате создания</option>
              <option value="name">По имени</option>
              <option value="size">По размеру</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:hidden">
          <Button variant="secondary" size="sm" onClick={() => setIsCreateFolderOpen(true)} className="flex-1">
            <Plus className="h-4 w-4" /> Папка
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={triggerMobileUpload}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4" /> {isUploading ? 'Загрузка...' : 'Загрузить'}
          </Button>
          <input
            id="upload-hidden-mobile"
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                void handleUpload(Array.from(event.target.files));
                event.target.value = '';
              }
            }}
          />
        </div>
        <UploadDropzone onFiles={(files) => void handleUpload(files)} />
        <UploadProgressList uploads={uploadQueue} />
          {selectedItems.length > 0 && (
              <SelectionBar
                count={selectedItems.length}
                onClear={resetSelection}
                onDelete={() => void handleDelete(selectedIsInTrash)}
                onDownload={() => void handleDownload()}
                onDownloadZip={() => void handleDownloadZip()}
                onShare={() => setIsShareOpen(true)}
                onMove={() => void openMoveModal(currentFolderId)}
                onRename={() => setIsRenameOpen(true)}
                onRestore={() => void handleRestore()}
                isTrashView={selectedIsInTrash}
                canDownload={selectedItems.some((item) => item.type === 'FILE')}
                canDownloadZip={
                  selectedItems.length > 1 || selectedItems.some((item) => item.type === 'FOLDER')
                }
                canShare={selectedItems.length === 1}
                canMove={selectedItems.length > 0}
                canRename={selectedItems.length === 1}
              />
          )}
          {renderContent()}
        </div>
      </div>
      <MobileQuickActions
        onCreateFolder={() => setIsCreateFolderOpen(true)}
        onUploadClick={triggerMobileUpload}
        isUploading={isUploading}
      />

      <Modal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        title="Новая папка"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleCreateFolder()}>Создать</Button>
          </>
        }
      >
        <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Название папки" />
      </Modal>

      <Modal
        isOpen={isRenameOpen && selectedItems.length === 1}
        onClose={() => setIsRenameOpen(false)}
        title="Переименовать"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsRenameOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleRename()}>Сохранить</Button>
          </>
        }
      >
        <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
      </Modal>

      <Modal
        isOpen={isShareOpen && selectedItems.length === 1}
        onClose={() => setIsShareOpen(false)}
        title="Публичная ссылка"
        description="Выберите права доступа и срок действия"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsShareOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleShare()}>Создать</Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <input
              type="radio"
              id="share-view"
              checked={sharePermission === 'VIEW'}
              onChange={() => setSharePermission('VIEW')}
            />
            <label htmlFor="share-view" className="font-medium">
              Только просмотр
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="radio"
              id="share-edit"
              checked={sharePermission === 'EDIT'}
              onChange={() => setSharePermission('EDIT')}
            />
            <label htmlFor="share-edit" className="font-medium">
              Право редактирования
            </label>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-400">Срок действия</label>
            <Input
              type="date"
              value={shareExpiration}
              onChange={(event) => setShareExpiration(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isMoveOpen}
        onClose={() => setIsMoveOpen(false)}
        title="Переместить"
        description="Выберите папку назначения"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsMoveOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleMove()}>Переместить</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button onClick={() => void openMoveModal(null)} className="font-semibold text-primary-600">
              Главная
            </button>
            {moveBreadcrumbs.map((crumb) => (
              <button key={crumb.id} onClick={() => void openMoveModal(crumb.id)} className="text-primary-500">
                / {crumb.name}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            {moveFolders.map((folder) => (
              <button
                key={folder.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition hover:border-primary-300 ${moveTarget === folder.id ? 'border-primary-400 bg-primary-500/10 text-primary-600' : 'border-slate-200 dark:border-slate-700'}`}
                onClick={() => setMoveTarget(folder.id)}
                onDoubleClick={() => void openMoveModal(folder.id)}
              >
                <span>{folder.name}</span>
                <FolderUp className="h-4 w-4" />
              </button>
            ))}
            {!moveFolders.length && <p className="text-sm text-slate-400">Папки отсутствуют</p>}
          </div>
        </div>
      </Modal>

      <PreviewModal
        item={previewItem}
        data={previewData}
        isOpen={Boolean(previewItem)}
        onClose={() => {
          setPreviewItem(null);
          setPreviewData(null);
        }}
      />
    </div>
  );
}
