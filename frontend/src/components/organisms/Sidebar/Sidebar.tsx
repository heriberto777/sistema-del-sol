import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  Contact,
  ExternalLink,
  FileText,
  Globe,
  HandCoins,
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
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useUrlTiendaPublica } from '../../../hooks/useUrlTiendaPublica';

const CLAVE_COLAPSADO = 'sol_sidebar_colapsado';
const CLAVE_GRUPOS_ABIERTOS = 'sol_sidebar_grupos_abiertos';

function leerColapsado(): boolean {
  try {
    return localStorage.getItem(CLAVE_COLAPSADO) === 'true';
  } catch {
    return false;
  }
}

function escribirColapsado(valor: boolean) {
  try {
    localStorage.setItem(CLAVE_COLAPSADO, String(valor));
  } catch {
    // localStorage deshabilitado — el toggle sigue funcionando en memoria para esta sesión.
  }
}

function leerGruposAbiertos(): string[] {
  try {
    const raw = localStorage.getItem(CLAVE_GRUPOS_ABIERTOS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function escribirGruposAbiertos(grupos: Set<string>) {
  try {
    localStorage.setItem(CLAVE_GRUPOS_ABIERTOS, JSON.stringify(Array.from(grupos)));
  } catch {
    // localStorage deshabilitado — los grupos siguen abriéndose/cerrándose en memoria para esta sesión.
  }
}

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
// `Reportes` vive suelto (no dentro de "Finanzas") a propósito — es un
// hub transversal (Ventas/Ventas agrupadas/Rentabilidad/Inventario/
// Compras/Comisiones/DGII, ver Reportes.tsx), no un reporte financiero;
// meterlo bajo Finanzas escondía "reporte de inventario" en un lugar
// donde nadie lo buscaría (auditoría de organización del Sidebar).
const SUELTOS_ARRIBA: Enlace[] = [
  { ruta: '/', etiqueta: 'Dashboard', icono: LayoutDashboard, permisos: ['reportes.ver'] },
  { ruta: '/reportes', etiqueta: 'Reportes', icono: BarChart3, permisos: ['reportes.ver'] },
];

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
      { ruta: '/tienda-online', etiqueta: 'Tienda Online', icono: Globe, permisos: ['admin.configuracion'], modulo: 'ecommerce' },
      // Sirve tanto a Ventas (clientes) como a Compras (proveedores) —
      // se prioriza acá por ser el uso más frecuente.
      { ruta: '/contactos', etiqueta: 'Contactos', icono: Contact, permisos: ['clientes.ver', 'compras.ver'] },
    ],
  },
  {
    // Antes "Cobranza" con un solo ítem (Cuentas por cobrar), mientras
    // Cuentas por pagar vivía metida dentro de "Inventario y Compras"
    // sin ninguna relación semántica con inventario — fusionadas acá
    // (auditoría de organización del Sidebar) porque ambas son la misma
    // clase de trabajo (seguimiento de saldos pendientes), solo que en
    // sentidos opuestos.
    id: 'cobros-pagos',
    etiqueta: 'Cobros y Pagos',
    items: [
      {
        ruta: '/cuentas-por-cobrar',
        etiqueta: 'Cuentas por cobrar',
        icono: WalletCards,
        permisos: ['cuentasporcobrar.ver'],
        modulo: 'facturacion',
      },
      {
        ruta: '/cuentas-por-pagar',
        etiqueta: 'Cuentas por pagar',
        icono: HandCoins,
        permisos: ['cuentasporpagar.ver'],
        modulo: 'compras',
      },
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
    ],
  },
  {
    id: 'gestion-humana',
    etiqueta: 'Gestión Humana',
    items: [
      { ruta: '/nomina', etiqueta: 'Nómina', icono: Users, permisos: ['nomina.ver'], modulo: 'nomina' },
      { ruta: '/rrhh', etiqueta: 'RRHH', icono: CalendarClock, permisos: ['rrhh.ver'], modulo: 'nomina' },
    ],
  },
  {
    id: 'sistema',
    etiqueta: 'Sistema',
    items: [
      // Antes vivía en "Inventario y Compras" — el propio código ya la
      // marcaba como "plomería de ubicación compartida" (la usan también
      // POS y Nómina, no es un concepto de inventario) — auditoría de
      // organización del Sidebar.
      { ruta: '/sucursales', etiqueta: 'Sucursales', icono: Building2, permisos: ['sucursales.ver'] },
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

/** Atajo directo a la tienda pública, sin pasar por la pantalla de Configuración — se muestra solo cuando "Tienda Online" ya es visible para este usuario Y la tienda está activada. */
function EnlaceTiendaExterno() {
  const urlTienda = useUrlTiendaPublica();
  if (!urlTienda) return null;
  return (
    <a
      href={urlTienda}
      target="_blank"
      rel="noreferrer"
      title="Ver mi tienda"
      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sol-600 dark:hover:bg-slate-900 dark:hover:text-sol-400"
    >
      <ExternalLink size={14} />
    </a>
  );
}

function grupoDeRuta(pathname: string): string | null {
  const grupo = GRUPOS.find((g) => g.items.some((item) => item.ruta === pathname));
  return grupo?.id ?? null;
}

interface SidebarProps {
  /** true en el drawer móvil — ignora el colapso a rail de ícono aunque el usuario lo tenga activado en desktop (en un drawer angosto no tiene sentido ocultar las etiquetas). */
  forzarExpandido?: boolean;
  /** Cierra el drawer móvil al navegar a un enlace — no-op en desktop. */
  onNavegar?: () => void;
}

export function Sidebar({ forzarExpandido, onNavegar }: SidebarProps = {}) {
  const { usuario, tienePermiso, tieneModulo } = useAuth();
  const location = useLocation();
  const [colapsadoInterno, setColapsadoInterno] = useState(leerColapsado);
  const colapsado = forzarExpandido ? false : colapsadoInterno;
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(() => {
    const persistidos = leerGruposAbiertos();
    const activo = grupoDeRuta(location.pathname);
    return new Set(activo ? [...persistidos, activo] : persistidos);
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
      escribirGruposAbiertos(siguiente);
      return siguiente;
    });
  }

  function alternarColapsado() {
    setColapsadoInterno((prev) => {
      const siguiente = !prev;
      escribirColapsado(siguiente);
      return siguiente;
    });
  }

  const enlaceClase = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      colapsado && 'justify-center px-0 py-2.5',
      isActive
        ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
    );

  const gruposVisibles = GRUPOS.map((g) => ({
    ...g,
    items: g.items.filter((item) => esVisible(item, tienePermiso, tieneModulo)),
  })).filter((g) => g.items.length > 0);

  return (
    <nav
      className={clsx(
        'flex h-full shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white p-4 transition-[width] duration-150 dark:border-slate-800 dark:bg-slate-950',
        colapsado ? 'w-[4.5rem]' : 'w-60',
      )}
    >
      <div className={clsx('mb-5 flex items-center gap-2.5 px-2', colapsado && 'justify-center px-0')}>
        {usuario?.tenant?.logo ? (
          <img
            src={usuario.tenant.logo}
            alt={usuario.tenant.nombre}
            className="h-9 w-9 shrink-0 rounded-lg object-contain shadow-sm"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-500 text-base font-bold text-white shadow-sm">
            S
          </div>
        )}
        {!colapsado && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">El Sistema del Sol</p>
            {usuario?.tenant?.nombre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{usuario.tenant.nombre}</p>}
          </div>
        )}
      </div>

      {SUELTOS_ARRIBA.filter((enlace) => esVisible(enlace, tienePermiso, tieneModulo)).map((enlace) => (
        <NavLink
          key={enlace.ruta}
          to={enlace.ruta}
          end={enlace.ruta === '/'}
          className={enlaceClase}
          title={colapsado ? enlace.etiqueta : undefined}
          onClick={onNavegar}
        >
          <enlace.icono size={17} className="shrink-0" />
          {!colapsado && enlace.etiqueta}
        </NavLink>
      ))}

      {gruposVisibles.map((grupo) => {
        const abierto = colapsado || gruposAbiertos.has(grupo.id);
        return (
          <div key={grupo.id} className={clsx('mt-1', colapsado && 'border-t border-slate-100 pt-1 dark:border-slate-800')}>
            {!colapsado && (
              <button
                type="button"
                onClick={() => alternarGrupo(grupo.id)}
                className="flex w-full items-center gap-1 rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <span>{abierto ? '▾' : '▸'}</span>
                {grupo.etiqueta}
              </button>
            )}
            {abierto && (
              <div className="flex flex-col gap-0.5">
                {grupo.items.map((enlace) =>
                  enlace.ruta === '/tienda-online' && !colapsado ? (
                    <div key={enlace.ruta} className="flex items-center gap-0.5">
                      <NavLink to={enlace.ruta} className={(p) => clsx(enlaceClase(p), 'flex-1')} onClick={onNavegar}>
                        <enlace.icono size={17} className="shrink-0" />
                        {enlace.etiqueta}
                      </NavLink>
                      <EnlaceTiendaExterno />
                    </div>
                  ) : (
                    <NavLink
                      key={enlace.ruta}
                      to={enlace.ruta}
                      className={enlaceClase}
                      title={colapsado ? enlace.etiqueta : undefined}
                      onClick={onNavegar}
                    >
                      <enlace.icono size={17} className="shrink-0" />
                      {!colapsado && enlace.etiqueta}
                    </NavLink>
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}

      {!forzarExpandido && (
        <div className="mt-auto pt-2">
          <button
            type="button"
            onClick={alternarColapsado}
            title={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
            className={clsx(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-300',
              colapsado && 'justify-center px-0',
            )}
          >
            {colapsado ? <ChevronsRight size={17} className="shrink-0" /> : <ChevronsLeft size={17} className="shrink-0" />}
            {!colapsado && 'Ocultar menú'}
          </button>
        </div>
      )}
    </nav>
  );
}
