import { ChevronRight, Home } from 'lucide-react';
import clsx from 'clsx';

interface Breadcrumb {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  items: Breadcrumb[];
  onNavigate: (folderId: string | null) => void;
  currentFolderId: string | null;
}

export function Breadcrumbs({ items, onNavigate, currentFolderId }: BreadcrumbsProps) {
  return (
    <nav aria-label="Навигация по папкам" className="flex items-center gap-2 text-sm text-slate-500">
      <button
        onClick={() => onNavigate(null)}
        className={clsx(
          'flex items-center gap-2 rounded-full px-3 py-1 transition hover:bg-slate-200 dark:hover:bg-slate-800',
          currentFolderId === null && 'font-semibold text-primary-500'
        )}
      >
        <Home className="h-4 w-4" /> Главная
      </button>
      {items.map((crumb) => (
        <button
          key={crumb.id}
          onClick={() => onNavigate(crumb.id)}
          className={clsx(
            'flex items-center gap-2 rounded-full px-3 py-1 transition hover:bg-slate-200 dark:hover:bg-slate-800',
            currentFolderId === crumb.id && 'font-semibold text-primary-500'
          )}
        >
          <ChevronRight className="h-4 w-4" /> {crumb.name}
        </button>
      ))}
    </nav>
  );
}
