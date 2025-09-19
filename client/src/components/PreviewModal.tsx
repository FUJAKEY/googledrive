import type { DriveItem } from '../types';
import { Modal } from './ui/Modal';

export interface PreviewData {
  type: 'image' | 'text' | 'pdf' | 'unknown';
  url?: string;
  content?: string;
}

interface PreviewModalProps {
  item: DriveItem | null;
  data?: PreviewData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PreviewModal({ item, data, isOpen, onClose }: PreviewModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item?.name}
      size={data?.type === 'pdf' ? 'lg' : 'md'}
      description={item?.mimeType ?? ''}
    >
      {data?.type === 'image' && data.url ? (
        <img src={data.url} alt={item?.name} className="max-h-[60vh] w-full rounded-xl object-contain" />
      ) : null}
      {data?.type === 'text' && data.content ? (
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {data.content}
        </pre>
      ) : null}
      {data?.type === 'pdf' && data.url ? (
        <iframe src={data.url} className="h-[70vh] w-full rounded-xl" title="PDF Preview" />
      ) : null}
      {!data && <p className="text-sm text-slate-400">Загрузка превью...</p>}
      {data?.type === 'unknown' && <p className="text-sm text-slate-400">Предпросмотр недоступен для этого файла.</p>}
    </Modal>
  );
}
