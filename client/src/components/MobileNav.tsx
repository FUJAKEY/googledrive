import { Link, useLocation } from 'react-router-dom';
import { Folder, Share2, Trash2 } from 'lucide-react';
import clsx from 'clsx';

const items = [
  { to: '/drive', label: 'Диск', icon: Folder },
  { to: '/shared', label: 'Доступ', icon: Share2 },
  { to: '/trash', label: 'Корзина', icon: Trash2 }
];

export function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 lg:hidden">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={clsx(
            'flex flex-col items-center gap-1 text-xs font-medium transition',
            pathname.startsWith(item.to)
              ? 'text-primary-600 dark:text-primary-300'
              : 'text-slate-400 dark:text-slate-500'
          )}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
