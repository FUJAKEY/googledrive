import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { ActivityItem } from '../types';
import { ScrollArea } from './ui/ScrollArea';
import { Activity } from 'lucide-react';

export function ActivityPanel({ activities }: { activities: ActivityItem[] }) {
  return (
    <aside className="hidden w-80 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-950 xl:flex">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Активность</p>
          <p className="text-xs text-slate-400">Последние операции</p>
        </div>
      </div>
      <ScrollArea className="mt-4 h-[420px] space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900">
            <p className="font-medium text-slate-800 dark:text-slate-100">{activity.message}</p>
            <p className="mt-2 text-xs text-slate-400">
              {formatDistanceToNow(new Date(activity.createdAt), { locale: ru, addSuffix: true })}
            </p>
          </div>
        ))}
        {!activities.length && (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-400 dark:bg-slate-900">
            История действий будет отображаться здесь.
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
