import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import clsx from 'clsx';
import { PlatformSidebar } from '../../organisms/PlatformSidebar/PlatformSidebar';
import { Button } from '../../atoms/Button/Button';
import { ThemeToggle } from '../../molecules/ThemeToggle/ThemeToggle';
import { usePlatformAuth } from '../../../hooks/usePlatformAuth';

/** Mismo patrón que AppLayout (tenant) — ítem "estilo y navegación" de Plataforma, incluido el drawer móvil (el Sidebar de ancho fijo se comía el viewport en mobile). */
export function PlatformLayout() {
  const { admin, logout } = usePlatformAuth();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {menuMovilAbierto && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 md:hidden" onClick={() => setMenuMovilAbierto(false)} aria-hidden="true" />
      )}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:z-auto md:translate-x-0',
          menuMovilAbierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <PlatformSidebar onNavegar={() => setMenuMovilAbierto(false)} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{admin?.nombre}</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variante="secundario" onClick={logout}>
              Cerrar sesión
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
