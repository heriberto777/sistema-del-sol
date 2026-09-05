import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import clsx from 'clsx';
import { Sidebar } from '../../organisms/Sidebar/Sidebar';
import { AccountMenu } from '../../organisms/AccountMenu/AccountMenu';
import { GlobalCrearMenu } from '../../organisms/GlobalCrearMenu/GlobalCrearMenu';
import { MarcarAsistenciaWidget } from '../../organisms/MarcarAsistenciaWidget/MarcarAsistenciaWidget';

/**
 * El Sidebar tiene ancho fijo (w-60, o el rail de w-[4.5rem] colapsado) —
 * en mobile eso se comía la mayor parte del viewport. Acá se muestra como
 * drawer fuera de flujo (fixed + translate-x), oculto por defecto bajo el
 * breakpoint `md`, con hamburguesa en el header y backdrop para cerrar.
 */
export function AppLayout() {
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
        <Sidebar forzarExpandido={menuMovilAbierto} onNavegar={() => setMenuMovilAbierto(false)} />
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
            <AccountMenu />
          </div>
          <div className="flex items-center gap-3">
            <MarcarAsistenciaWidget />
            <GlobalCrearMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
