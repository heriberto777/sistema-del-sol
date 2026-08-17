import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';

interface Enlace {
  ruta: string;
  etiqueta: string;
  permisos?: string[];
}

interface Grupo {
  id: string;
  etiqueta: string;
  items: Enlace[];
}

// `permisos: undefined` = visible para cualquier usuario autenticado.
// `permisos: string[]` = se muestra si el usuario tiene AL MENOS UNO.
const SUELTOS_ARRIBA: Enlace[] = [{ ruta: '/', etiqueta: 'Dashboard', permisos: ['reportes.ver'] }];

const GRUPOS: Grupo[] = [
  {
    id: 'ventas',
    etiqueta: 'Ventas',
    items: [
      { ruta: '/facturacion', etiqueta: 'Facturación', permisos: ['facturacion.ver'] },
      { ruta: '/cotizaciones', etiqueta: 'Cotizaciones', permisos: ['cotizaciones.ver'] },
      { ruta: '/remisiones', etiqueta: 'Remisiones', permisos: ['remisiones.ver'] },
      { ruta: '/pos', etiqueta: 'Punto de venta', permisos: ['pos.ver'] },
    ],
  },
  {
    id: 'inventario-compras',
    etiqueta: 'Inventario y Compras',
    items: [
      { ruta: '/inventario', etiqueta: 'Inventario', permisos: ['inventario.ver'] },
      { ruta: '/compras', etiqueta: 'Compras', permisos: ['compras.ver'] },
      { ruta: '/productos', etiqueta: 'Productos', permisos: ['precios.ver'] },
      { ruta: '/bancos', etiqueta: 'Bancos', permisos: ['bancos.ver'] },
      { ruta: '/gastos-menores', etiqueta: 'Gastos menores', permisos: ['gastosmenores.ver'] },
    ],
  },
  {
    id: 'finanzas',
    etiqueta: 'Finanzas',
    items: [
      { ruta: '/contabilidad', etiqueta: 'Contabilidad', permisos: ['contabilidad.ver'] },
      { ruta: '/nomina', etiqueta: 'Nómina', permisos: ['nomina.ver'] },
      { ruta: '/reportes', etiqueta: 'Reportes', permisos: ['reportes.ver'] },
    ],
  },
  {
    id: 'sistema',
    etiqueta: 'Sistema',
    items: [
      { ruta: '/ia', etiqueta: 'IA', permisos: ['ia.usar'] },
      { ruta: '/notificaciones', etiqueta: 'Notificaciones', permisos: ['notificaciones.ver'] },
      { ruta: '/admin', etiqueta: 'Admin', permisos: ['admin.usuarios', 'admin.plugins', 'admin.configuracion'] },
    ],
  },
];

// Sirve tanto a Ventas (clientes) como a Compras (proveedores) — no encaja
// limpio en ningún grupo, se deja suelto debajo de todos.
const SUELTOS_ABAJO: Enlace[] = [{ ruta: '/contactos', etiqueta: 'Contactos', permisos: ['clientes.ver', 'compras.ver'] }];

function esVisible(enlace: Enlace, tienePermiso: (permiso: string) => boolean) {
  return !enlace.permisos || enlace.permisos.some(tienePermiso);
}

function grupoDeRuta(pathname: string): string | null {
  const grupo = GRUPOS.find((g) => g.items.some((item) => item.ruta === pathname));
  return grupo?.id ?? null;
}

export function Sidebar() {
  const { usuario, tienePermiso } = useAuth();
  const location = useLocation();
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(() => {
    const activo = grupoDeRuta(location.pathname);
    return new Set(activo ? [activo] : []);
  });

  useEffect(() => {
    const activo = grupoDeRuta(location.pathname);
    if (activo) {
      setGruposAbiertos((prev) => (prev.has(activo) ? prev : new Set(prev).add(activo)));
    }
  }, [location.pathname]);

  function alternarGrupo(id: string) {
    setGruposAbiertos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  const enlaceClase = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'block rounded-md px-3 py-2 text-sm font-medium',
      isActive
        ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
    );

  const gruposVisibles = GRUPOS.map((g) => ({ ...g, items: g.items.filter((item) => esVisible(item, tienePermiso)) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <nav className="flex h-full w-56 flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 px-2">
        <p className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</p>
        {usuario?.tenant?.nombre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{usuario.tenant.nombre}</p>}
      </div>

      {SUELTOS_ARRIBA.filter((enlace) => esVisible(enlace, tienePermiso)).map((enlace) => (
        <NavLink key={enlace.ruta} to={enlace.ruta} end={enlace.ruta === '/'} className={enlaceClase}>
          {enlace.etiqueta}
        </NavLink>
      ))}

      {gruposVisibles.map((grupo) => {
        const abierto = gruposAbiertos.has(grupo.id);
        return (
          <div key={grupo.id}>
            <button
              type="button"
              onClick={() => alternarGrupo(grupo.id)}
              className="flex w-full items-center gap-1 rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <span>{abierto ? '▾' : '▸'}</span>
              {grupo.etiqueta}
            </button>
            {abierto && (
              <div className="ml-2 flex flex-col gap-1">
                {grupo.items.map((enlace) => (
                  <NavLink key={enlace.ruta} to={enlace.ruta} className={enlaceClase}>
                    {enlace.etiqueta}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {SUELTOS_ABAJO.filter((enlace) => esVisible(enlace, tienePermiso)).map((enlace) => (
        <NavLink key={enlace.ruta} to={enlace.ruta} className={enlaceClase}>
          {enlace.etiqueta}
        </NavLink>
      ))}
    </nav>
  );
}
