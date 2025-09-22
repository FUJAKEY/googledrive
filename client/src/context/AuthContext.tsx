import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextState {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authorizedFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const AuthContext = createContext<AuthContextState | undefined>(undefined);

function buildUrl(path: string) {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    () => window.localStorage.getItem('clouddrive.accessToken')
  );
  const [loading, setLoading] = useState(true);

  const storeSession = useCallback((nextUser: AuthUser, token: string) => {
    setUser(nextUser);
    setAccessToken(token);
    window.localStorage.setItem('clouddrive.accessToken', token);
    window.localStorage.setItem('clouddrive.user', JSON.stringify(nextUser));
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    window.localStorage.removeItem('clouddrive.accessToken');
    window.localStorage.removeItem('clouddrive.user');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(buildUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('refresh_failed');
      }
      const data = await response.json();
      storeSession(data.user, data.accessToken);
    } catch {
      clearSession();
    }
  }, [clearSession, storeSession]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const response = await fetch(buildUrl('/api/auth/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!response.ok) {
        const payload = await parseResponse<{ message?: string }>(response);
        throw new Error(payload?.message ?? 'Ошибка авторизации');
      }
      const data = await response.json();
      storeSession(data.user, data.accessToken);
      toast.success('Добро пожаловать!');
    },
    [storeSession]
  );

  const register = useCallback(
    async (input: { email: string; password: string; name: string }) => {
      const response = await fetch(buildUrl('/api/auth/register'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (!response.ok) {
        const payload = await parseResponse<{ message?: string }>(response);
        throw new Error(payload?.message ?? 'Не удалось зарегистрироваться');
      }
      const data = await response.json();
      storeSession(data.user, data.accessToken);
      toast.success('Аккаунт создан!');
    },
    [storeSession]
  );

  const logout = useCallback(async () => {
    await fetch(buildUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include'
    });
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    const storedUser = window.localStorage.getItem('clouddrive.user');
    if (storedUser && !user) {
      setUser(JSON.parse(storedUser));
    }
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authorizedFetch = useCallback(
    async <T,>(path: string, init?: RequestInit) => {
      const execute = async (token?: string): Promise<T> => {
        const headers = new Headers(init?.headers ?? {});
        const isFormData =
          typeof FormData !== 'undefined' && init?.body instanceof FormData;

        if (!isFormData && !headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }

        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await fetch(buildUrl(path), {
          ...init,
          credentials: 'include',
          headers
        });
        if (response.status === 401) {
          throw new Error('unauthorized');
        }
        if (!response.ok) {
          const payload = await parseResponse<{ message?: string }>(response);
          throw new Error(payload?.message ?? 'Ошибка запроса');
        }
        return parseResponse<T>(response);
      };

      try {
        return await execute(accessToken ?? undefined);
      } catch (error) {
        if ((error as Error).message === 'unauthorized') {
          await refresh();
          const latestToken = window.localStorage.getItem('clouddrive.accessToken') ?? undefined;
          if (!latestToken) {
            throw error;
          }
          return execute(latestToken);
        }
        throw error;
      }
    },
    [accessToken, refresh]
  );

  const value = useMemo(
    () => ({ user, accessToken, loading, login, register, logout, refresh, authorizedFetch }),
    [user, accessToken, loading, login, register, logout, refresh, authorizedFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
