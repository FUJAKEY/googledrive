import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { MobileNav } from '../components/MobileNav';
import { ActivityPanel } from '../components/ActivityPanel';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import type { ActivityItem } from '../types';

export function AppLayout() {
  const { authorizedFetch } = useAuth();
  const { data } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ['activity'],
    queryFn: () => authorizedFetch('/api/activity'),
    staleTime: 1000 * 60
  });

  return (
    <div className="min-h-screen bg-surface-light text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1">
          <Outlet />
        </main>
        <ActivityPanel activities={data?.activities ?? []} />
      </div>
      <MobileNav />
    </div>
  );
}
