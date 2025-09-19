import type { ReactNode } from 'react';
import { MoonStar, Sun, LogOut } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { useAuth } from '../hooks/useAuth';

interface TopbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
  actions?: ReactNode;
}

export function Topbar({ search, onSearchChange, onToggleTheme, theme, actions }: TopbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-20 max-w-7xl flex-col justify-center gap-4 px-4 py-3 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск по названию и типу"
              className="w-full min-w-[200px] bg-white/80 dark:bg-slate-900/80"
            />
            {actions}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleTheme}
              className="rounded-full border border-slate-200 dark:border-slate-700"
            >
              {theme === 'light' ? <MoonStar className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <div className="hidden flex-col text-right text-sm lg:flex">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{user?.name}</span>
              <span className="text-xs text-slate-400">{user?.email}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
