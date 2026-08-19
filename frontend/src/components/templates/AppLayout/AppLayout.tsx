import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../organisms/Sidebar/Sidebar';
import { Button } from '../../atoms/Button/Button';
import { ThemeToggle } from '../../molecules/ThemeToggle/ThemeToggle';
import { GlobalCrearMenu } from '../../organisms/GlobalCrearMenu/GlobalCrearMenu';
import { useAuth } from '../../../hooks/useAuth';

function iniciales(nombre?: string) {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
}

export function AppLayout() {
  const { usuario, logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sol-100 text-xs font-semibold text-sol-700 dark:bg-sol-900/40 dark:text-sol-300">
              {iniciales(usuario?.nombre)}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{usuario?.nombre}</span>
          </div>
          <div className="flex items-center gap-3">
            <GlobalCrearMenu />
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
