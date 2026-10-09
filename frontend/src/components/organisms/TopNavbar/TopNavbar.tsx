import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { useMenuErp } from '../../../hooks/useMenuErp';
import { useUrlTiendaPublica } from '../../../hooks/useUrlTiendaPublica';
import { ETIQUETA_CATEGORIA_ERP, type CategoriaErp } from '../../../config/menu-erp';

const ORDEN_CATEGORIAS: CategoriaErp[] = ['catalogos', 'transacciones', 'consultas', 'reportes', 'configuracion'];

/**
 * Navbar superior estilo ERP modular (Softland) — reemplaza al Sidebar
 * lateral de 2 niveles. Cada dominio abre un flyout con sus categorías
 * (Catálogos/Transacciones/Consultas/Reportes/Configuración) como columnas;
 * las utilidades transversales (Dashboard, Reportes, Mis tareas...) quedan
 * sueltas a la izquierda, fuera de cualquier dominio — mismo criterio que
 * `SUELTOS_ARRIBA` del Sidebar anterior. La tira de dominios es scrolleable
 * en vez de recortarse: un tenant con todos los plugins activos puede tener
 * más de los que entran en una pantalla, y recortarlos sería perder acceso
 * en vez de solo un scroll lateral.
 */
export function TopNavbar({ onNavegar }: { onNavegar?: () => void } = {}) {
  const { dominios, utilidades } = useMenuErp();
  const urlTienda = useUrlTiendaPublica();
  const [abierto, setAbierto] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(null);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(null);
    }
    document.addEventListener('mousedown', onClickFuera);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickFuera);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  function cerrarYNavegar() {
    setAbierto(null);
    onNavegar?.();
  }

  const enlaceClase = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
    );

  return (
    <nav ref={ref} className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
      {utilidades.map((item) => (
        <NavLink key={item.id} to={item.ruta} end={item.ruta === '/'} className={enlaceClase} onClick={cerrarYNavegar}>
          {item.etiqueta}
        </NavLink>
      ))}

      {utilidades.length > 0 && dominios.length > 0 && <div className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-800" />}

      {dominios.map((dominio) => {
        const Icono = dominio.icono;
        const estaAbierto = abierto === dominio.id;
        return (
          <div key={dominio.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAbierto((prev) => (prev === dominio.id ? null : dominio.id))}
              className={clsx(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                estaAbierto
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
              )}
            >
              <Icono size={15} className="shrink-0" />
              {dominio.etiqueta}
              <ChevronDown size={13} className={clsx('shrink-0 transition-transform', estaAbierto && 'rotate-180')} />
            </button>

            {estaAbierto && (
              <div className="absolute left-0 top-full z-30 mt-1 flex gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                {ORDEN_CATEGORIAS.map((catKey) => {
                  const categoria = dominio.categorias.find((c) => c.categoria === catKey);
                  if (!categoria) return null;
                  return (
                    <div key={catKey} className="min-w-[180px]">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {ETIQUETA_CATEGORIA_ERP[catKey]}
                        {catKey === 'catalogos' && dominio.id === 'tienda' && urlTienda && (
                          <a href={urlTienda} target="_blank" rel="noreferrer" title="Ver mi tienda" className="text-sol-500 hover:text-sol-600">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <ul className="flex flex-col gap-0.5">
                        {categoria.items.map((item) => (
                          <li key={item.id}>
                            <NavLink
                              to={item.ruta}
                              onClick={cerrarYNavegar}
                              className={({ isActive }) =>
                                clsx(
                                  'block rounded-md px-2 py-1.5 text-sm transition-colors',
                                  isActive
                                    ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
                                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                                )
                              }
                            >
                              {item.etiqueta}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
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
