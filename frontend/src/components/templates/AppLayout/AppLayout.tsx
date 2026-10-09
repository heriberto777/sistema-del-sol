import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import clsx from 'clsx';
import { SidebarErp } from '../../organisms/SidebarErp/SidebarErp';
import { AccountMenu } from '../../organisms/AccountMenu/AccountMenu';
import { GlobalCrearMenu } from '../../organisms/GlobalCrearMenu/GlobalCrearMenu';
import { MarcarAsistenciaWidget } from '../../organisms/MarcarAsistenciaWidget/MarcarAsistenciaWidget';
import { BandejaWhatsappWidget } from '../../organisms/BandejaWhatsappWidget/BandejaWhatsappWidget';
import { BandejaWhatsappDrawer } from '../../organisms/BandejaWhatsappDrawer/BandejaWhatsappDrawer';
import { BandejaWhatsappDrawerProvider } from '../../organisms/BandejaWhatsappDrawer/BandejaWhatsappDrawerContext';
import { PopupAlertasInventario } from '../../organisms/PopupAlertasInventario/PopupAlertasInventario';

/**
 * Sidebar lateral ERP (`SidebarErp`, acordeón de 3 niveles: Dominio →
 * Categoría → Ítem) — mismo mecanismo de drawer fuera de flujo en mobile
 * que ya usaba el Sidebar de 2 niveles anterior, un solo componente para
 * ambos casos (`onNavegar` cierra el drawer al navegar, no-op en desktop).
 */
export function AppLayout() {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  return (
    <BandejaWhatsappDrawerProvider>
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
          <SidebarErp onNavegar={() => setMenuMovilAbierto(false)} />
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
              <BandejaWhatsappWidget />
              <GlobalCrearMenu />
            </div>
          </header>
          {/* `overflow-x-hidden` es una red de seguridad, no el fix en sí (mismo
              criterio que Modal.tsx) — si una página se olvida de envolver una
              tabla/barra de tabs ancha en su propio `overflow-x-auto`, el
              desborde queda contenido acá en vez de arrastrar horizontalmente
              todo el layout (header, sidebar) en móvil. */}
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
        <BandejaWhatsappDrawer />
        <PopupAlertasInventario />
      </div>
    </BandejaWhatsappDrawerProvider>
  );
}
