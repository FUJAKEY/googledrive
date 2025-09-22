import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { ApiKeySummary } from '../types';
import { useAuth } from '../hooks/useAuth';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CreateApiKeyResponse {
  key: string;
  apiKey: ApiKeySummary;
}

export function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
  const { authorizedFetch } = useAuth();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
    []
  );

  const resetState = () => {
    setLabel('');
    setGeneratedKey(null);
    setRemovingId(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authorizedFetch<{ keys: ApiKeySummary[] }>(
        '/api/auth/api-keys'
      );
      setKeys(response.keys);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    if (isOpen) {
      setGeneratedKey(null);
      void loadKeys();
    }
  }, [isOpen, loadKeys]);

  const handleCreate = async () => {
    const payload: Record<string, string> = {};
    if (label.trim()) {
      payload.label = label.trim();
    }

    setCreating(true);
    try {
      const response = await authorizedFetch<CreateApiKeyResponse>('/api/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setKeys((prev) => [response.apiKey, ...prev]);
      setGeneratedKey(response.key);
      setLabel('');
      toast.success('API-ключ создан');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Ключ скопирован');
    } catch {
      toast.error('Не удалось скопировать ключ');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Удалить API-ключ? Действие необратимо.')) {
      return;
    }
    setRemovingId(id);
    try {
      await authorizedFetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' });
      setKeys((prev) => prev.filter((key) => key.id !== id));
      toast.success('API-ключ удалён');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) {
      return 'ещё не использовался';
    }
    return dateFormatter.format(new Date(value));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="API-доступ"
      description="Генерируйте ключи для интеграций и автоматизации. Храните секреты в безопасном месте — повторно ключ не отображается."
    >
      <div className="space-y-4">
        {generatedKey && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/60 dark:bg-emerald-500/10">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
              Новый ключ создан. Скопируйте и сохраните его сейчас — после закрытия он будет недоступен.
            </p>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-mono text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100">
              <span className="flex-1 truncate" title={generatedKey}>
                {generatedKey}
              </span>
              <Button variant="secondary" size="sm" onClick={() => handleCopy(generatedKey)}>
                <Copy className="h-4 w-4" />
                Скопировать
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Создать ключ</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Назовите ключ, чтобы понять его назначение. Например, «CI/CD» или «Интеграция с CRM».
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Название ключа"
            />
            <Button type="button" disabled={creating} onClick={() => void handleCreate()}>
              <Plus className="h-4 w-4" /> Создать
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Активные ключи</h3>
          {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка списка…</p>}
          {!loading && keys.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Пока нет активных ключей. Создайте первый, чтобы управлять CloudDrive через API.
            </p>
          )}
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 shadow-sm transition hover:border-primary-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {key.label ?? 'Без названия'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Создан {formatDate(key.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDelete(key.id)}
                    disabled={removingId === key.id}
                  >
                    <Trash2 className="h-4 w-4" /> Удалить
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  Последнее использование: {formatDate(key.lastUsedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
