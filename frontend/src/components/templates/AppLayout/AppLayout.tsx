import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../organisms/Sidebar/Sidebar';
import { Button } from '../../atoms/Button/Button';
import { ThemeToggle } from '../../molecules/ThemeToggle/ThemeToggle';
import { GlobalCrearMenu } from '../../organisms/GlobalCrearMenu/GlobalCrearMenu';
import { useAuth } from '../../../hooks/useAuth';

export function AppLayout() {
  const { usuario, logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950">
          <span className="text-sm text-slate-500 dark:text-slate-400">Hola, {usuario?.nombre}</span>
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
