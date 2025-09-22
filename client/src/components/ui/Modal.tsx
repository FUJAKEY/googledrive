import { Fragment, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, description, actions, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <Fragment>
      <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6">
        <div
          className={clsx(
            'relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900',
            size === 'lg' && 'max-w-3xl'
          )}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
          {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          <div className="mt-4 space-y-4 text-slate-700 dark:text-slate-200">{children}</div>
          {actions && <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{actions}</div>}
        </div>
      </div>
    </Fragment>,
    document.body
  );
}
