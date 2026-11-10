import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';

export interface SubNavTab {
  to: string;
  etiqueta: string;
  /** Si no tiene permiso, la pestaña no se muestra — mismo criterio que `esVisible()` de menu-erp.ts. */
  permiso?: string;
  /**
   * Para una pestaña cuyo destino tiene sub-rutas propias (ej. "Configuración"
   * de Tienda Online, que navega a /configuracion/identidad pero debe seguir
   * resaltada en /configuracion/apariencia) — se resalta si la URL actual
   * empieza con esto, en vez del match exacto de `to` (Fase 7).
   */
  prefijoActivo?: string;
}

/**
 * Reemplaza el patrón `const PESTANAS = [...] + useState(default)` que tenían
 * Contabilidad/Nómina/Tienda Online/Reportes — cada pestaña es ahora una ruta
 * real de React Router (`NavLink`), así un link de menú siempre abre lo que
 * promete en vez de caer siempre en la primera pestaña (bug real encontrado
 * en la auditoría de organización, ver docs/ARCHITECTURE.md).
 */
export function SubNavTabs({ tabs, tienePermiso }: { tabs: SubNavTab[]; tienePermiso: (p: string) => boolean }) {
  const visibles = tabs.filter((t) => !t.permiso || tienePermiso(t.permiso));
  const location = useLocation();

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {visibles.map((t) => {
        const claseBase = (activa: boolean) =>
          clsx(
            'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
            activa
              ? 'border-sol-500 text-sol-600 dark:text-sol-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
          );
        if (t.prefijoActivo) {
          const activa = location.pathname.startsWith(t.prefijoActivo);
          return (
            <NavLink key={t.to} to={t.to} className={claseBase(activa)}>
              {t.etiqueta}
            </NavLink>
          );
        }
        return (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => claseBase(isActive)}>
            {t.etiqueta}
          </NavLink>
        );
      })}
    </div>
  );
}
