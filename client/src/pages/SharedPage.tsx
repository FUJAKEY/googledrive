import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2, Copy, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Topbar } from '../components/Topbar';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import type { ShareLink } from '../types';
import { Button } from '../components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export function SharedPage() {
  const { authorizedFetch } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ links: ShareLink[] }>({
    queryKey: ['share', search],
    queryFn: () => authorizedFetch('/api/share'),
    staleTime: 1000 * 30
  });

  const filteredLinks = (data?.links ?? []).filter((link) =>
    link.item?.name?.toLowerCase().includes(search.toLowerCase()) ?? false
  );

  const copyLink = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Ссылка скопирована'))
      .catch(() => toast.error('Не удалось скопировать ссылку'));
  };

  const revokeLink = async (id: string) => {
    await authorizedFetch(`/api/share/${id}`, { method: 'DELETE' });
    toast.success('Доступ закрыт');
    void queryClient.invalidateQueries({ queryKey: ['share'] });
  };

  return (
    <div className="flex flex-col">
      <Topbar
        search={search}
        onSearchChange={setSearch}
        onToggleTheme={toggleTheme}
        theme={theme}
        actions={null}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-32 pt-6 sm:px-8 lg:px-12">
        <div className="rounded-3xl bg-white p-6 shadow-soft dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500">
            <Share2 className="h-5 w-5 text-primary-500" />
            <span>Общие ссылки</span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-2xl bg-slate-100 p-6 dark:bg-slate-800" />
              ))}
            {!isLoading && !filteredLinks.length && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 dark:border-slate-700">
                Пока нет активных ссылок
              </div>
            )}
            {filteredLinks.map((link) => (
              <div
                key={link.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-primary-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {link.item?.name ?? 'Без названия'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {link.permission === 'VIEW' ? 'Только просмотр' : 'Редактирование'}
                    </p>
                  </div>
                  {link.expiresAt ? (
                    <span className="rounded-full bg-primary-500/10 px-3 py-1 text-xs text-primary-600 dark:text-primary-300">
                      Истекает {formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true, locale: ru })}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-300">
                      Без ограничений
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{link.url}</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => copyLink(link.url)}>
                    <Copy className="h-4 w-4" /> Копировать
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => window.open(link.url, '_blank')}>
                    <ExternalLink className="h-4 w-4" /> Открыть
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void revokeLink(link.id)}>
                    <Trash2 className="h-4 w-4" /> Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
