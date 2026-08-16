import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';

// `permisos: undefined` = visible para cualquier usuario autenticado (ningún
// enlace hoy lo necesita, pero queda soportado). `permisos: string[]` = se
// muestra si el usuario tiene AL MENOS UNO (así "Admin", que agrupa varias
// pestañas con permisos distintos, aparece con cualquiera de ellos).
const ENLACES: { ruta: string; etiqueta: string; permisos?: string[] }[] = [
  { ruta: '/', etiqueta: 'Dashboard', permisos: ['reportes.ver'] },
  { ruta: '/facturacion', etiqueta: 'Facturación', permisos: ['facturacion.ver'] },
  { ruta: '/cotizaciones', etiqueta: 'Cotizaciones', permisos: ['cotizaciones.ver'] },
  { ruta: '/remisiones', etiqueta: 'Remisiones', permisos: ['remisiones.ver'] },
  { ruta: '/inventario', etiqueta: 'Inventario', permisos: ['inventario.ver'] },
  { ruta: '/compras', etiqueta: 'Compras', permisos: ['compras.ver'] },
  { ruta: '/contactos', etiqueta: 'Contactos', permisos: ['clientes.ver', 'compras.ver'] },
  { ruta: '/productos', etiqueta: 'Productos', permisos: ['precios.ver'] },
  { ruta: '/reportes', etiqueta: 'Reportes', permisos: ['reportes.ver'] },
  { ruta: '/contabilidad', etiqueta: 'Contabilidad', permisos: ['contabilidad.ver'] },
  { ruta: '/nomina', etiqueta: 'Nómina', permisos: ['nomina.ver'] },
  { ruta: '/pos', etiqueta: 'Punto de venta', permisos: ['pos.ver'] },
  { ruta: '/ia', etiqueta: 'IA', permisos: ['ia.usar'] },
  { ruta: '/notificaciones', etiqueta: 'Notificaciones', permisos: ['notificaciones.ver'] },
  { ruta: '/admin', etiqueta: 'Admin', permisos: ['admin.usuarios', 'admin.plugins', 'admin.configuracion'] },
];

export function Sidebar() {
  const { tienePermiso } = useAuth();
  const enlacesVisibles = ENLACES.filter((enlace) => !enlace.permisos || enlace.permisos.some(tienePermiso));

  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="mb-4 px-2 text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</p>
      {enlacesVisibles.map((enlace) => (
        <NavLink
          key={enlace.ruta}
          to={enlace.ruta}
          end={enlace.ruta === '/'}
          className={({ isActive }) =>
            clsx(
              'rounded-md px-3 py-2 text-sm font-medium',
              isActive
                ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
            )
          }
        >
          {enlace.etiqueta}
        </NavLink>
      ))}
    </nav>
  );
}
