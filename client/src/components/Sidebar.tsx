import { Link, useLocation } from 'react-router-dom';
import { Folder, Share2, Trash2, Cloud } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { to: '/drive', label: 'Мой диск', icon: Folder },
  { to: '/shared', label: 'Доступно мне', icon: Share2 },
  { to: '/trash', label: 'Корзина', icon: Trash2 }
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden h-full w-64 flex-col gap-6 border-r border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950 lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-soft">
          <Cloud className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">CloudDrive</p>
          <p className="text-xs text-slate-400">Ваш цифровой хаб</p>
        </div>
      </div>
      <nav className="mt-4 space-y-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={clsx(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition hover:bg-primary-500/10 hover:text-primary-600 dark:hover:bg-primary-500/10 dark:hover:text-primary-300',
              pathname.startsWith(item.to)
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-300'
                : 'text-slate-500 dark:text-slate-300'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl bg-primary-500/10 p-4">
        <p className="text-sm font-semibold text-primary-600 dark:text-primary-200">Совет дня</p>
        <p className="mt-2 text-xs text-primary-600/70 dark:text-primary-200/70">
          Создавайте публичные ссылки, чтобы делиться файлами с клиентами в один клик.
        </p>
      </div>
    </aside>
  );
}
