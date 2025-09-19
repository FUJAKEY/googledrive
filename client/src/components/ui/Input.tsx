import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-primary-500',
        className
      )}
      {...props}
    />
  );
}
