import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Download, Folder, Moon, RefreshCcw, Sun } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { useTheme } from '../hooks/useTheme';
import type { ShareAccessResponse, DriveItem } from '../types';
import { resolveFileIcon, formatSize } from '../utils/fileIcons';

const ENV_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = ENV_BASE ? ENV_BASE.replace(/\/$/, '') : '';

function buildUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

type PreviewState =
  | { type: 'image'; url: string }
  | { type: 'pdf'; url: string }
  | { type: 'text'; content: string }
  | { type: 'unknown' }
  | null;

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function driveItemSort(a: DriveItem, b: DriveItem) {
  if (a.type !== b.type) {
    return a.type === 'FOLDER' ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'ru');
}

export function ShareViewerPage() {
  const { token } = useParams<{ token: string }>();
  const { theme, toggleTheme } = useTheme();
  const [preview, setPreview] = useState<PreviewState>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    error
  } = useQuery({
    queryKey: ['share', token],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) throw new Error('missing_token');
      const response = await fetch(buildUrl(`/s/${token}`), {
        headers: { Accept: 'application/json' },
        credentials: 'include'
      });
      if (response.status === 404) {
        throw new Error('not_found');
      }
      if (response.status === 410) {
        throw new Error('expired');
      }
      if (!response.ok) {
        throw new Error('unknown_error');
      }
      return (await response.json()) as ShareAccessResponse;
    }
  });

  useEffect(() => {
    let revokeUrl: string | null = null;
    const controller = new AbortController();

    async function loadPreview(current: ShareAccessResponse) {
      if (current.item.type !== 'FILE') {
        setPreview(null);
        return;
      }
      const mime = current.item.mimeType ?? '';
      if (!mime) {
        setPreview({ type: 'unknown' });
        return;
      }
      setPreviewLoading(true);
      try {
        const response = await fetch(buildUrl(`/s/${token}/download`), {
          credentials: 'include',
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('preview_failed');
        }
        if (mime.includes('image')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          revokeUrl = url;
          setPreview({ type: 'image', url });
        } else if (mime.includes('pdf')) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          revokeUrl = url;
          setPreview({ type: 'pdf', url });
        } else if (mime.includes('text') || mime.includes('markdown') || mime.includes('json')) {
          const text = await response.text();
          setPreview({ type: 'text', content: text });
        } else {
          setPreview({ type: 'unknown' });
        }
      } catch (previewError) {
        if ((previewError as Error).name !== 'AbortError') {
          setPreview({ type: 'unknown' });
        }
      } finally {
        setPreviewLoading(false);
      }
    }

    if (data) {
      void loadPreview(data);
    }

    return () => {
      controller.abort();
      if (revokeUrl) {
        URL.revokeObjectURL(revokeUrl);
      }
    };
  }, [data, token]);

  const sortedChildren = useMemo(() => {
    if (!data?.children?.length) return [] as DriveItem[];
    return [...data.children].sort(driveItemSort);
  }, [data?.children]);

  const permissionLabel = useMemo(() => {
    switch (data?.permission) {
      case 'EDIT':
        return 'Редактирование';
      case 'VIEW':
      default:
        return 'Просмотр';
    }
  }, [data?.permission]);

  const expiresLabel = useMemo(() => formatDate(data?.expiresAt), [data?.expiresAt]);

  const primaryAction = () => {
    if (!data) return;
    if (data.item.type === 'FILE') {
      const url = buildUrl(data.downloadUrl ?? `/s/${token}/download`);
      window.open(url, '_blank', 'noopener');
    } else {
      const url = buildUrl(data.archiveUrl ?? `/s/${token}/archive`);
      window.open(url, '_blank', 'noopener');
    }
  };

  const showError = error instanceof Error;
  const errorCode = showError ? error.message : null;

  return (
    <div
      className={clsx(
        'min-h-screen w-full bg-surface-light text-slate-900 transition-colors duration-300',
        theme === 'dark' && 'dark bg-surface-dark text-slate-100'
      )}
    >
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-12 pt-6 sm:px-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/30">
              <Folder className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">CloudDrive — общий доступ</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Получите быстрый доступ к файлам и папкам даже без аккаунта
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => (window.location.href = '/')}
              className="hidden sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" /> На главную
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label="Переключить тему"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <main className="flex-1">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-40 w-full rounded-3xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-3xl" />
            </div>
          ) : showError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center dark:border-rose-400/40 dark:bg-rose-500/10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold">Ссылка недоступна</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                {errorCode === 'expired'
                  ? 'Срок действия ссылки истёк. Попросите владельца создать новую.'
                  : 'Элемент не найден или ссылка была отозвана владельцем.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Обновить страницу
                </Button>
                <Button variant="ghost" onClick={() => refetch()}>
                  <RefreshCcw className="h-4 w-4" /> Повторить запрос
                </Button>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-10">
              <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-primary-500/5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{data.item.name}</h2>
                      <Badge variant={data.permission === 'EDIT' ? 'success' : 'default'}>
                        {permissionLabel}
                      </Badge>
                      {expiresLabel ? (
                        <Badge variant="warning">Доступ до {expiresLabel}</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {data.item.type === 'FILE'
                        ? `Файл • ${formatSize(data.item.size ?? undefined)}`
                        : 'Папка • общий доступ к содержимому'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={primaryAction} size="lg" className="min-w-[12rem]">
                      <Download className="h-5 w-5" />
                      {data.item.type === 'FILE' ? 'Скачать файл' : 'Скачать архив'}
                    </Button>
                    <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
                      <RefreshCcw className="h-4 w-4" /> Обновить данные
                    </Button>
                  </div>
                </div>

                {data.item.type === 'FILE' ? (
                  <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/60">
                    {previewLoading ? (
                      <div className="flex h-48 w-full items-center justify-center">
                        <Skeleton className="h-32 w-32 rounded-2xl" />
                      </div>
                    ) : preview?.type === 'image' ? (
                      <img
                        src={preview.url}
                        alt={data.item.name}
                        className="mx-auto max-h-96 w-full rounded-xl object-contain shadow-lg"
                      />
                    ) : preview?.type === 'pdf' ? (
                      <iframe
                        src={preview.url}
                        title={data.item.name}
                        className="h-[480px] w-full rounded-xl border border-slate-200 dark:border-slate-700"
                      />
                    ) : preview?.type === 'text' ? (
                      <pre className="max-h-96 overflow-auto rounded-xl bg-slate-900/90 p-4 text-sm text-slate-100 shadow-inner">
                        {preview.content}
                      </pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-slate-500 dark:text-slate-300">
                        <Download className="h-6 w-6" />
                        <p>Предпросмотр недоступен. Скачайте файл для просмотра содержимого.</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>

              {data.item.type === 'FOLDER' ? (
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold sm:text-xl">Содержимое папки</h3>
                  {sortedChildren.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      Папка пока пуста. Добавьте файлы, чтобы поделиться ими.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {sortedChildren.map((child) => {
                        const Icon = resolveFileIcon(child);
                        return (
                          <div
                            key={child.id}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-primary-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800 dark:text-slate-100">{child.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {child.type === 'FILE' ? formatSize(child.size ?? undefined) : 'Папка'}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs uppercase tracking-wide text-slate-400">
                              {child.type === 'FILE' ? 'Файл' : 'Папка'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
