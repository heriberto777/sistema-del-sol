import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Button } from '../../atoms/Button/Button';
import { ThemeToggle } from '../../molecules/ThemeToggle/ThemeToggle';
import { usePlatformAuth } from '../../../hooks/usePlatformAuth';

interface EnlacePlataforma {
  ruta: string;
  etiqueta: string;
  permiso?: string;
}

const ENLACES: EnlacePlataforma[] = [
  { ruta: '/plataforma/tenants', etiqueta: 'Tenants', permiso: 'platform.tenants.ver' },
  { ruta: '/plataforma/planes', etiqueta: 'Planes', permiso: 'platform.planes.ver' },
  { ruta: '/plataforma/facturas', etiqueta: 'Facturas', permiso: 'platform.facturacion.ver' },
  { ruta: '/plataforma/admins', etiqueta: 'Admins', permiso: 'platform.admins.ver' },
  { ruta: '/plataforma/roles', etiqueta: 'Roles', permiso: 'platform.roles.ver' },
];

/** Header compartido por las páginas de plataforma — evita repetir título/nav/logout en cada una. */
export function PlatformHeader({ titulo }: { titulo: string }) {
  const { admin, logout, tienePermiso } = usePlatformAuth();
  const enlacesVisibles = ENLACES.filter((enlace) => !enlace.permiso || tienePermiso(enlace.permiso));

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold text-sol-600 dark:text-sol-400">Plataforma — {titulo}</h1>
        <nav className="flex items-center gap-3">
          {enlacesVisibles.map((enlace) => (
            <NavLink
              key={enlace.ruta}
              to={enlace.ruta}
              className={({ isActive }) =>
                clsx(
                  'text-sm',
                  isActive
                    ? 'font-medium text-sol-600 dark:text-sol-400'
                    : 'text-slate-500 hover:underline dark:text-slate-400',
                )
              }
            >
              {enlace.etiqueta}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">{admin?.nombre}</span>
        <ThemeToggle />
        <Button variante="secundario" onClick={logout}>
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}
