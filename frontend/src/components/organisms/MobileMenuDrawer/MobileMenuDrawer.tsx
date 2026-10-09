import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../../hooks/useAuth';
import { useMenuErp } from '../../../hooks/useMenuErp';
import { ETIQUETA_CATEGORIA_ERP, type CategoriaErp } from '../../../config/menu-erp';

const ORDEN_CATEGORIAS: CategoriaErp[] = ['catalogos', 'transacciones', 'consultas', 'reportes', 'configuracion'];

/**
 * Versión mobile del navbar ERP: el flyout horizontal de `TopNavbar` no
 * cabe en una pantalla angosta, así que acá es un acordeón de 3 niveles
 * (Dominio → Categoría → Ítem) dentro del drawer que ya abre la hamburguesa
 * de `AppLayout`. Solo un dominio expandido a la vez, para que la lista no
 * se vuelva interminable en una pantalla chica.
 */
export function MobileMenuDrawer({ onNavegar }: { onNavegar: () => void }) {
  const { usuario } = useAuth();
  const { dominios, utilidades } = useMenuErp();
  const [dominioAbierto, setDominioAbierto] = useState<string | null>(null);

  const enlaceClase = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
    );

  return (
    <nav className="flex h-full w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center gap-2.5 px-2">
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

      {utilidades.map((item) => (
        <NavLink key={item.id} to={item.ruta} end={item.ruta === '/'} className={enlaceClase} onClick={onNavegar}>
          {item.etiqueta}
        </NavLink>
      ))}

      <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

      {dominios.map((dominio) => {
        const Icono = dominio.icono;
        const abierto = dominioAbierto === dominio.id;
        return (
          <div key={dominio.id}>
            <button
              type="button"
              onClick={() => setDominioAbierto((prev) => (prev === dominio.id ? null : dominio.id))}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Icono size={16} className="shrink-0" />
              <span className="flex-1">{dominio.etiqueta}</span>
              <ChevronDown size={14} className={clsx('shrink-0 transition-transform', abierto && 'rotate-180')} />
            </button>

            {abierto && (
              <div className="ml-3 flex flex-col gap-2 border-l border-slate-200 py-2 pl-3 dark:border-slate-800">
                {ORDEN_CATEGORIAS.map((catKey) => {
                  const categoria = dominio.categorias.find((c) => c.categoria === catKey);
                  if (!categoria) return null;
                  return (
                    <div key={catKey}>
                      <div className="mb-1 px-3 text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {ETIQUETA_CATEGORIA_ERP[catKey]}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {categoria.items.map((item) => (
                          <NavLink key={item.id} to={item.ruta} className={enlaceClase} onClick={onNavegar}>
                            {item.etiqueta}
                          </NavLink>
                        ))}
                      </div>
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
