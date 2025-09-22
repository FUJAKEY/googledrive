import type { ReactNode } from 'react';
import clsx from 'clsx';

export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('custom-scrollbar overflow-y-auto pr-2', className)}>
      {children}
    </div>
  );
}
