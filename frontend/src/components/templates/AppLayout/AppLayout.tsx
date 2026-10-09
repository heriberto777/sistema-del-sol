import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';
import { TopNavbar } from '../../organisms/TopNavbar/TopNavbar';
import { MobileMenuDrawer } from '../../organisms/MobileMenuDrawer/MobileMenuDrawer';
import { AccountMenu } from '../../organisms/AccountMenu/AccountMenu';
import { GlobalCrearMenu } from '../../organisms/GlobalCrearMenu/GlobalCrearMenu';
import { MarcarAsistenciaWidget } from '../../organisms/MarcarAsistenciaWidget/MarcarAsistenciaWidget';
import { BandejaWhatsappWidget } from '../../organisms/BandejaWhatsappWidget/BandejaWhatsappWidget';
import { BandejaWhatsappDrawer } from '../../organisms/BandejaWhatsappDrawer/BandejaWhatsappDrawer';
import { BandejaWhatsappDrawerProvider } from '../../organisms/BandejaWhatsappDrawer/BandejaWhatsappDrawerContext';
import { PopupAlertasInventario } from '../../organisms/PopupAlertasInventario/PopupAlertasInventario';

/**
 * Navbar superior estilo ERP (reemplaza al Sidebar lateral) — dos filas:
 * logo+cuenta+widgets arriba, dominios con flyout debajo. En mobile el
 * flyout horizontal no cabe, así que la segunda fila se oculta y la
 * hamburguesa abre un drawer con el mismo árbol en acordeón
 * (`MobileMenuDrawer`), mismo mecanismo de overlay que usaba el Sidebar.
 */
export function AppLayout() {
  const { usuario } = useAuth();
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  return (
    <BandejaWhatsappDrawerProvider>
      <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
        {menuMovilAbierto && (
          <div className="fixed inset-0 z-30 bg-slate-900/50 md:hidden" onClick={() => setMenuMovilAbierto(false)} aria-hidden="true" />
        )}
        <div
          className={clsx(
            'fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:hidden',
            menuMovilAbierto ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <MobileMenuDrawer onNavegar={() => setMenuMovilAbierto(false)} />
        </div>

        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            {usuario?.tenant?.logo ? (
              <img src={usuario.tenant.logo} alt={usuario.tenant.nombre} className="hidden h-8 w-auto max-w-[8.5rem] shrink-0 rounded-md object-contain md:block" />
            ) : (
              <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sol-500 text-sm font-bold text-white md:flex">S</div>
            )}
            <AccountMenu />
          </div>
          <div className="flex items-center gap-3">
            <MarcarAsistenciaWidget />
            <BandejaWhatsappWidget />
            <GlobalCrearMenu />
          </div>
        </header>

        <div className="hidden md:block">
          <TopNavbar />
        </div>

        {/* `overflow-x-hidden` es una red de seguridad, no el fix en sí (mismo
            criterio que Modal.tsx) — si una página se olvida de envolver una
            tabla/barra de tabs ancha en su propio `overflow-x-auto`, el
            desborde queda contenido acá en vez de arrastrar horizontalmente
            todo el layout en móvil. */}
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>

        <BandejaWhatsappDrawer />
        <PopupAlertasInventario />
      </div>
    </BandejaWhatsappDrawerProvider>
  );
}
