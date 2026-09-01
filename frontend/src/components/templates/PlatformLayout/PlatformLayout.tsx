import { Outlet } from 'react-router-dom';
import { PlatformSidebar } from '../../organisms/PlatformSidebar/PlatformSidebar';
import { Button } from '../../atoms/Button/Button';
import { ThemeToggle } from '../../molecules/ThemeToggle/ThemeToggle';
import { usePlatformAuth } from '../../../hooks/usePlatformAuth';

/** Mismo patrón que AppLayout (tenant) — ítem "estilo y navegación" de Plataforma. */
export function PlatformLayout() {
  const { admin, logout } = usePlatformAuth();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <PlatformSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{admin?.nombre}</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variante="secundario" onClick={logout}>
              Cerrar sesión
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
