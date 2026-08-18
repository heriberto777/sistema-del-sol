import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';

interface Enlace {
  ruta: string;
  etiqueta: string;
  permisos?: string[];
  /** Clave de `MODULOS_BASE` — si está presente, además exige que el tenant lo tenga activo (plan + excepciones). */
  modulo?: string;
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
      { ruta: '/facturacion', etiqueta: 'Facturación', permisos: ['facturacion.ver'], modulo: 'facturacion' },
      { ruta: '/cotizaciones', etiqueta: 'Cotizaciones', permisos: ['cotizaciones.ver'], modulo: 'cotizaciones' },
      { ruta: '/remisiones', etiqueta: 'Remisiones', permisos: ['remisiones.ver'], modulo: 'remisiones' },
      { ruta: '/pos', etiqueta: 'Punto de venta', permisos: ['pos.ver'], modulo: 'pos' },
      // Sirve tanto a Ventas (clientes) como a Compras (proveedores) —
      // se prioriza acá por ser el uso más frecuente.
      { ruta: '/contactos', etiqueta: 'Contactos', permisos: ['clientes.ver', 'compras.ver'] },
    ],
  },
  {
    id: 'inventario-compras',
    etiqueta: 'Inventario y Compras',
    items: [
      { ruta: '/inventario', etiqueta: 'Inventario', permisos: ['inventario.ver'], modulo: 'inventario' },
      { ruta: '/compras', etiqueta: 'Compras', permisos: ['compras.ver'], modulo: 'compras' },
      { ruta: '/productos', etiqueta: 'Productos', permisos: ['precios.ver'], modulo: 'productos' },
    ],
  },
  {
    id: 'finanzas',
    etiqueta: 'Finanzas',
    items: [
      { ruta: '/contabilidad', etiqueta: 'Contabilidad', permisos: ['contabilidad.ver'] },
      { ruta: '/bancos', etiqueta: 'Bancos', permisos: ['bancos.ver'], modulo: 'bancos' },
      // Aunque el nombre sugiere "compras", lo que hace en el código es
      // 100% financiero: exige NCF fiscal, descuenta de una cuenta
      // bancaria puntual, valida que el período contable esté abierto, y
      // genera un asiento contable automático — no toca inventario ni
      // proveedores en ningún momento.
      { ruta: '/gastos-menores', etiqueta: 'Gastos menores', permisos: ['gastosmenores.ver'], modulo: 'gastosmenores' },
      { ruta: '/reportes', etiqueta: 'Reportes', permisos: ['reportes.ver'] },
    ],
  },
  {
    id: 'gestion-humana',
    etiqueta: 'Gestión Humana',
    items: [{ ruta: '/nomina', etiqueta: 'Nómina', permisos: ['nomina.ver'], modulo: 'nomina' }],
  },
  {
    id: 'sistema',
    etiqueta: 'Sistema',
    items: [
      { ruta: '/ia', etiqueta: 'IA', permisos: ['ia.usar'], modulo: 'ia' },
      { ruta: '/notificaciones', etiqueta: 'Notificaciones', permisos: ['notificaciones.ver'] },
      { ruta: '/admin', etiqueta: 'Admin', permisos: ['admin.usuarios', 'admin.configuracion'] },
    ],
  },
];

function esVisible(
  enlace: Enlace,
  tienePermiso: (permiso: string) => boolean,
  tieneModulo: (modulo: string) => boolean,
) {
  if (enlace.modulo && !tieneModulo(enlace.modulo)) return false;
  return !enlace.permisos || enlace.permisos.some(tienePermiso);
}

function grupoDeRuta(pathname: string): string | null {
  const grupo = GRUPOS.find((g) => g.items.some((item) => item.ruta === pathname));
  return grupo?.id ?? null;
}

export function Sidebar() {
  const { usuario, tienePermiso, tieneModulo } = useAuth();
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

  const gruposVisibles = GRUPOS.map((g) => ({
    ...g,
    items: g.items.filter((item) => esVisible(item, tienePermiso, tieneModulo)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="flex h-full w-56 flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 px-2">
        <p className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</p>
        {usuario?.tenant?.nombre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{usuario.tenant.nombre}</p>}
      </div>

      {SUELTOS_ARRIBA.filter((enlace) => esVisible(enlace, tienePermiso, tieneModulo)).map((enlace) => (
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
    </nav>
  );
}
