import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';
import { useMenuErp } from '../../../hooks/useMenuErp';
import { useUrlTiendaPublica } from '../../../hooks/useUrlTiendaPublica';
import { ETIQUETA_CATEGORIA_ERP, type CategoriaErp, type DominioMenu, type ItemMenu } from '../../../config/menu-erp';

const CLAVE_DOMINIO_ABIERTO = 'sol_sidebar_dominio_abierto';
const CLAVE_CATEGORIA_ABIERTA = 'sol_sidebar_categoria_abierta';
const CLAVE_COLAPSADO = 'sol_sidebar_colapsado';
const ORDEN_CATEGORIAS: CategoriaErp[] = ['catalogos', 'transacciones', 'consultas', 'reportes', 'configuracion'];

function leerString(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirString(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    // localStorage deshabilitado — el estado sigue funcionando en memoria para esta sesión.
  }
}

function leerBooleano(clave: string): boolean {
  try {
    return localStorage.getItem(clave) === 'true';
  } catch {
    return false;
  }
}

function escribirBooleano(clave: string, valor: boolean) {
  try {
    localStorage.setItem(clave, String(valor));
  } catch {
    // localStorage deshabilitado — el colapso sigue funcionando en memoria para esta sesión.
  }
}

/** Dominio + clave de categoría ("dominioId:categoria") que contienen la ruta activa, o null si ninguno. */
function ubicarRutaActiva(pathname: string, dominios: DominioMenu[]): { dominioId: string; claveCategoria: string } | null {
  for (const dominio of dominios) {
    for (const cat of dominio.categorias) {
      if (cat.items.some((item) => item.ruta === pathname)) {
        return { dominioId: dominio.id, claveCategoria: `${dominio.id}:${cat.categoria}` };
      }
    }
  }
  return null;
}

/**
 * Sidebar ERP — acordeón real de 3 niveles (Dominio → Categoría → Ítem),
 * reemplaza al navbar superior con flyout (quedaba cortado por el scroll
 * horizontal del contenedor). Acordeón EXCLUSIVO a propósito en los dos
 * niveles de grupo: abrir un dominio cierra el que estuviera abierto antes
 * (y lo mismo entre categorías de un mismo dominio) — pedido explícito del
 * usuario tras ver que Ventas y Compras quedaban abiertas a la vez.
 */
export function SidebarErp({ onNavegar }: { onNavegar?: () => void } = {}) {
  const { usuario } = useAuth();
  const { dominios, utilidades } = useMenuErp();
  const urlTienda = useUrlTiendaPublica();
  const location = useLocation();

  const [colapsado, setColapsado] = useState(leerBooleano(CLAVE_COLAPSADO));
  const [dominioAbierto, setDominioAbierto] = useState<string | null>(() => {
    const activo = ubicarRutaActiva(location.pathname, dominios);
    return activo?.dominioId ?? leerString(CLAVE_DOMINIO_ABIERTO);
  });
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(() => {
    const activo = ubicarRutaActiva(location.pathname, dominios);
    return activo?.claveCategoria ?? leerString(CLAVE_CATEGORIA_ABIERTA);
  });

  useEffect(() => {
    const activo = ubicarRutaActiva(location.pathname, dominios);
    if (!activo) return;
    setDominioAbierto(activo.dominioId);
    setCategoriaAbierta(activo.claveCategoria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function alternarColapsado() {
    setColapsado((prev) => {
      const siguiente = !prev;
      escribirBooleano(CLAVE_COLAPSADO, siguiente);
      return siguiente;
    });
  }

  function alternarDominio(id: string) {
    // Clic en un dominio colapsado: expande el sidebar entero además de abrirlo — un colapsado no tiene
    // espacio para mostrar categorías/ítems, así que no tendría sentido "abrirlo" sin expandir primero.
    if (colapsado) {
      setColapsado(false);
      escribirBooleano(CLAVE_COLAPSADO, false);
    }
    setDominioAbierto((prev) => {
      const siguiente = prev === id ? null : id;
      escribirString(CLAVE_DOMINIO_ABIERTO, siguiente);
      if (siguiente === null) {
        setCategoriaAbierta(null);
        escribirString(CLAVE_CATEGORIA_ABIERTA, null);
      }
      return siguiente;
    });
  }

  function alternarCategoria(clave: string) {
    setCategoriaAbierta((prev) => {
      const siguiente = prev === clave ? null : clave;
      escribirString(CLAVE_CATEGORIA_ABIERTA, siguiente);
      return siguiente;
    });
  }

  const enlaceClase = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'block rounded-lg px-2.5 py-1.5 text-sm transition-colors',
      isActive
        ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
    );

  function renderItem(item: ItemMenu) {
    return (
      <NavLink key={item.id} to={item.ruta} end={item.ruta === '/'} className={enlaceClase} onClick={onNavegar}>
        {item.etiqueta}
      </NavLink>
    );
  }

  return (
    <nav
      className={clsx(
        'sidebar-scroll flex h-full shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white p-3 transition-[width] duration-150 dark:border-slate-800 dark:bg-slate-950',
        colapsado ? 'w-[4.5rem]' : 'w-72',
      )}
    >
      <div className={clsx('mb-3 flex items-center gap-2 pt-1', colapsado ? 'flex-col px-0' : 'px-2')}>
        {usuario?.tenant?.logo ? (
          <img
            src={usuario.tenant.logo}
            alt={usuario.tenant.nombre}
            className={clsx('shrink-0 rounded-lg object-contain shadow-sm', colapsado ? 'h-9 w-9 max-w-none' : 'h-9 w-auto max-w-[8rem]')}
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-500 text-base font-bold text-white shadow-sm">S</div>
        )}
        {!colapsado && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">El Sistema del Sol</p>
            {usuario?.tenant?.nombre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{usuario.tenant.nombre}</p>}
          </div>
        )}
        <button
          type="button"
          onClick={alternarColapsado}
          title={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-300"
        >
          {colapsado ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </div>

      {utilidades.map((item) =>
        colapsado ? (
          <NavLink
            key={item.id}
            to={item.ruta}
            end={item.ruta === '/'}
            title={item.etiqueta}
            onClick={onNavegar}
            className={({ isActive }) =>
              clsx(
                'flex items-center justify-center rounded-lg py-2 text-xs font-semibold',
                isActive
                  ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
              )
            }
          >
            {item.etiqueta.slice(0, 2).toUpperCase()}
          </NavLink>
        ) : (
          renderItem(item)
        ),
      )}

      {utilidades.length > 0 && dominios.length > 0 && <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />}

      {dominios.map((dominio) => {
        const Icono = dominio.icono;
        const domAbierto = !colapsado && dominioAbierto === dominio.id;
        const categoriasPresentes = ORDEN_CATEGORIAS.map((k) => dominio.categorias.find((c) => c.categoria === k)).filter(
          (c): c is NonNullable<typeof c> => !!c,
        );

        return (
          <div key={dominio.id}>
            <button
              type="button"
              onClick={() => alternarDominio(dominio.id)}
              title={colapsado ? dominio.etiqueta : undefined}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                colapsado ? 'justify-center px-0' : 'px-2.5',
              )}
            >
              <Icono size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
              {!colapsado && (
                <>
                  <span className="min-w-0 flex-1 truncate">{dominio.etiqueta}</span>
                  <ChevronRight size={14} className={clsx('shrink-0 text-slate-400 transition-transform', domAbierto && 'rotate-90')} />
                </>
              )}
            </button>

            {domAbierto && (
              <div className="ml-3 flex flex-col border-l border-slate-200 pl-2.5 dark:border-slate-800">
                {categoriasPresentes.map((cat) => {
                  const clave = `${dominio.id}:${cat.categoria}`;
                  const catAbierta = categoriaAbierta === clave;
                  return (
                    <div key={clave}>
                      <button
                        type="button"
                        onClick={() => alternarCategoria(clave)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-900 dark:hover:text-slate-300"
                      >
                        <span className="min-w-0 flex-1 truncate">{ETIQUETA_CATEGORIA_ERP[cat.categoria]}</span>
                        {cat.categoria === 'catalogos' && dominio.id === 'tienda' && urlTienda && (
                          <a
                            href={urlTienda}
                            target="_blank"
                            rel="noreferrer"
                            title="Ver mi tienda"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sol-500 hover:text-sol-600"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <ChevronRight size={11} className={clsx('shrink-0 transition-transform', catAbierta && 'rotate-90')} />
                      </button>
                      {catAbierta && <div className="mb-1 ml-1 flex flex-col gap-0.5">{cat.items.map(renderItem)}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
