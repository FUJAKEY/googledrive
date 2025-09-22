import type { ReactNode } from 'react';
import clsx from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning';

export function Badge({
  children,
  variant = 'default',
  className
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  const styles: Record<BadgeVariant, string> = {
    default: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
  };

  return (
    <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', styles[variant], className)}>
      {children}
    </span>
  );
}
