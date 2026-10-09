import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';
import { useMenuErp } from '../../../hooks/useMenuErp';
import { useUrlTiendaPublica } from '../../../hooks/useUrlTiendaPublica';
import { ETIQUETA_CATEGORIA_ERP, type CategoriaErp, type DominioMenu, type ItemMenu } from '../../../config/menu-erp';

const CLAVE_DOMINIOS_ABIERTOS = 'sol_sidebar_dominios_abiertos';
const CLAVE_CATEGORIAS_ABIERTAS = 'sol_sidebar_categorias_abiertas';
const ORDEN_CATEGORIAS: CategoriaErp[] = ['catalogos', 'transacciones', 'consultas', 'reportes', 'configuracion'];

function leerSet(clave: string): Set<string> {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function escribirSet(clave: string, valor: Set<string>) {
  try {
    localStorage.setItem(clave, JSON.stringify(Array.from(valor)));
  } catch {
    // localStorage deshabilitado — el estado sigue funcionando en memoria para esta sesión.
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
 * Sidebar ERP — acordeón real de 3 niveles (Dominio → Categoría →
 * Ítem, los 3 colapsables), reemplaza al navbar superior con flyout
 * (quedaba cortado por el scroll horizontal del contenedor — Modelo A
 * validado con el usuario sobre un artifact antes de implementarlo).
 * Un solo componente para desktop y mobile (`forzarExpandido`/`onNavegar`),
 * mismo criterio que el Sidebar original de 2 niveles.
 */
export function SidebarErp({ onNavegar }: { onNavegar?: () => void } = {}) {
  const { usuario } = useAuth();
  const { dominios, utilidades } = useMenuErp();
  const urlTienda = useUrlTiendaPublica();
  const location = useLocation();

  const [dominiosAbiertos, setDominiosAbiertos] = useState<Set<string>>(() => {
    const persistidos = leerSet(CLAVE_DOMINIOS_ABIERTOS);
    const activo = ubicarRutaActiva(location.pathname, dominios);
    return activo ? new Set(persistidos).add(activo.dominioId) : persistidos;
  });
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Set<string>>(() => {
    const persistidos = leerSet(CLAVE_CATEGORIAS_ABIERTAS);
    const activo = ubicarRutaActiva(location.pathname, dominios);
    return activo ? new Set(persistidos).add(activo.claveCategoria) : persistidos;
  });

  useEffect(() => {
    const activo = ubicarRutaActiva(location.pathname, dominios);
    if (!activo) return;
    setDominiosAbiertos((prev) => (prev.has(activo.dominioId) ? prev : new Set(prev).add(activo.dominioId)));
    setCategoriasAbiertas((prev) => (prev.has(activo.claveCategoria) ? prev : new Set(prev).add(activo.claveCategoria)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function alternarDominio(id: string) {
    setDominiosAbiertos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      escribirSet(CLAVE_DOMINIOS_ABIERTOS, siguiente);
      return siguiente;
    });
  }

  function alternarCategoria(clave: string) {
    setCategoriasAbiertas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      escribirSet(CLAVE_CATEGORIAS_ABIERTAS, siguiente);
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
    <nav className="flex h-full w-72 shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center gap-2.5 px-2 pt-1">
        {usuario?.tenant?.logo ? (
          <img src={usuario.tenant.logo} alt={usuario.tenant.nombre} className="h-9 w-auto max-w-[9.5rem] shrink-0 rounded-lg object-contain shadow-sm" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-500 text-base font-bold text-white shadow-sm">S</div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">El Sistema del Sol</p>
          {usuario?.tenant?.nombre && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{usuario.tenant.nombre}</p>}
        </div>
      </div>

      {utilidades.map(renderItem)}

      {utilidades.length > 0 && dominios.length > 0 && <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />}

      {dominios.map((dominio) => {
        const Icono = dominio.icono;
        const domAbierto = dominiosAbiertos.has(dominio.id);
        const categoriasPresentes = ORDEN_CATEGORIAS.map((k) => dominio.categorias.find((c) => c.categoria === k)).filter(
          (c): c is NonNullable<typeof c> => !!c,
        );

        return (
          <div key={dominio.id}>
            <button
              type="button"
              onClick={() => alternarDominio(dominio.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Icono size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
              <span className="min-w-0 flex-1 truncate">{dominio.etiqueta}</span>
              <ChevronRight size={14} className={clsx('shrink-0 text-slate-400 transition-transform', domAbierto && 'rotate-90')} />
            </button>

            {domAbierto && (
              <div className="ml-3 flex flex-col border-l border-slate-200 pl-2.5 dark:border-slate-800">
                {categoriasPresentes.map((cat) => {
                  const clave = `${dominio.id}:${cat.categoria}`;
                  const catAbierta = categoriasAbiertas.has(clave);
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
