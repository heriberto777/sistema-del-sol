import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Contact,
  FileText,
  LayoutDashboard,
  Landmark,
  type LucideIcon,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

interface Enlace {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
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
const SUELTOS_ARRIBA: Enlace[] = [{ ruta: '/', etiqueta: 'Dashboard', icono: LayoutDashboard, permisos: ['reportes.ver'] }];

const GRUPOS: Grupo[] = [
  {
    id: 'ventas',
    etiqueta: 'Ventas',
    items: [
      { ruta: '/facturacion', etiqueta: 'Facturación', icono: Receipt, permisos: ['facturacion.ver'], modulo: 'facturacion' },
      { ruta: '/cotizaciones', etiqueta: 'Cotizaciones', icono: FileText, permisos: ['cotizaciones.ver'], modulo: 'cotizaciones' },
      { ruta: '/remisiones', etiqueta: 'Remisiones', icono: Truck, permisos: ['remisiones.ver'], modulo: 'remisiones' },
      { ruta: '/notas-credito', etiqueta: 'Notas de crédito/débito', icono: RotateCcw, permisos: ['facturacion.ver'], modulo: 'facturacion' },
      { ruta: '/pos', etiqueta: 'Punto de venta', icono: Store, permisos: ['pos.ver'], modulo: 'pos' },
      // Sirve tanto a Ventas (clientes) como a Compras (proveedores) —
      // se prioriza acá por ser el uso más frecuente.
      { ruta: '/contactos', etiqueta: 'Contactos', icono: Contact, permisos: ['clientes.ver', 'compras.ver'] },
    ],
  },
  {
    id: 'inventario-compras',
    etiqueta: 'Inventario y Compras',
    items: [
      { ruta: '/inventario', etiqueta: 'Inventario', icono: Boxes, permisos: ['inventario.ver'], modulo: 'inventario' },
      { ruta: '/compras', etiqueta: 'Compras', icono: ShoppingBag, permisos: ['compras.ver'], modulo: 'compras' },
      { ruta: '/productos', etiqueta: 'Productos', icono: Tag, permisos: ['precios.ver'], modulo: 'productos' },
    ],
  },
  {
    id: 'finanzas',
    etiqueta: 'Finanzas',
    items: [
      { ruta: '/contabilidad', etiqueta: 'Contabilidad', icono: BookOpen, permisos: ['contabilidad.ver'] },
      { ruta: '/bancos', etiqueta: 'Bancos', icono: Landmark, permisos: ['bancos.ver'], modulo: 'bancos' },
      // Aunque el nombre sugiere "compras", lo que hace en el código es
      // 100% financiero: exige NCF fiscal, descuenta de una cuenta
      // bancaria puntual, valida que el período contable esté abierto, y
      // genera un asiento contable automático — no toca inventario ni
      // proveedores en ningún momento.
      { ruta: '/gastos-menores', etiqueta: 'Gastos menores', icono: Wallet, permisos: ['gastosmenores.ver'], modulo: 'gastosmenores' },
      { ruta: '/reportes', etiqueta: 'Reportes', icono: BarChart3, permisos: ['reportes.ver'] },
    ],
  },
  {
    id: 'gestion-humana',
    etiqueta: 'Gestión Humana',
    items: [{ ruta: '/nomina', etiqueta: 'Nómina', icono: Users, permisos: ['nomina.ver'], modulo: 'nomina' }],
  },
  {
    id: 'sistema',
    etiqueta: 'Sistema',
    items: [
      { ruta: '/ia', etiqueta: 'IA', icono: Sparkles, permisos: ['ia.usar'], modulo: 'ia' },
      { ruta: '/notificaciones', etiqueta: 'Notificaciones', icono: Bell, permisos: ['notificaciones.ver'] },
      { ruta: '/admin', etiqueta: 'Admin', icono: Settings, permisos: ['admin.usuarios', 'admin.configuracion'] },
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
      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
    );

  const gruposVisibles = GRUPOS.map((g) => ({
    ...g,
    items: g.items.filter((item) => esVisible(item, tienePermiso, tieneModulo)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="flex h-full w-60 flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-500 text-base font-bold text-white shadow-sm">
          S
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">El Sistema del Sol</p>
          {usuario?.tenant?.nombre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{usuario.tenant.nombre}</p>}
        </div>
      </div>

      {SUELTOS_ARRIBA.filter((enlace) => esVisible(enlace, tienePermiso, tieneModulo)).map((enlace) => (
        <NavLink key={enlace.ruta} to={enlace.ruta} end={enlace.ruta === '/'} className={enlaceClase}>
          <enlace.icono size={17} className="shrink-0" />
          {enlace.etiqueta}
        </NavLink>
      ))}

      {gruposVisibles.map((grupo) => {
        const abierto = gruposAbiertos.has(grupo.id);
        return (
          <div key={grupo.id} className="mt-1">
            <button
              type="button"
              onClick={() => alternarGrupo(grupo.id)}
              className="flex w-full items-center gap-1 rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <span>{abierto ? '▾' : '▸'}</span>
              {grupo.etiqueta}
            </button>
            {abierto && (
              <div className="flex flex-col gap-0.5">
                {grupo.items.map((enlace) => (
                  <NavLink key={enlace.ruta} to={enlace.ruta} className={enlaceClase}>
                    <enlace.icono size={17} className="shrink-0" />
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
