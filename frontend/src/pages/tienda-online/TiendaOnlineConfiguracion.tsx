import { TiendaOnlineConfigPanel } from '../../components/organisms/TiendaOnlineConfigPanel/TiendaOnlineConfigPanel';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';
import { VolverAConfiguracion } from '../../components/molecules/VolverAConfiguracion/VolverAConfiguracion';

// Benchmark 2026-11-09 — página standalone (ya no usa `ModuloPestanas` con
// las pestañas hermanas de Tienda Online) — se llega acá solo desde el hub
// central (/configuracion), mismo criterio que `/travel-config`. Ver el
// comentario en ./tabs.ts.
export function TiendaOnlineConfiguracion() {
  return (
    <div className="space-y-4">
      <VolverAConfiguracion />
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dominio propio y branding</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Identidad, logo, plantilla y personalización del storefront de Tienda Online.</p>
      </div>
      <RequierePermiso permiso="admin.configuracion">
        <TiendaOnlineConfigPanel />
      </RequierePermiso>
    </div>
  );
}
