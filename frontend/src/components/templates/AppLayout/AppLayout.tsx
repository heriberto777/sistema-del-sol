import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../organisms/Sidebar/Sidebar';
import { AccountMenu } from '../../organisms/AccountMenu/AccountMenu';
import { GlobalCrearMenu } from '../../organisms/GlobalCrearMenu/GlobalCrearMenu';
import { MarcarAsistenciaWidget } from '../../organisms/MarcarAsistenciaWidget/MarcarAsistenciaWidget';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <AccountMenu />
          <div className="flex items-center gap-3">
            <MarcarAsistenciaWidget />
            <GlobalCrearMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
