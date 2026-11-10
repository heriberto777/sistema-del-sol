import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Las 20 pantallas del hub de Configuración (`/configuracion`) ya no tienen
 * entrada propia en el menú de su dominio (benchmark 2026-11-09, "consolidar
 * todo en un solo lugar") — se llega a todas exclusivamente desde el hub, así
 * que este link de regreso es seguro y siempre correcto en cualquiera de ellas.
 */
export function VolverAConfiguracion() {
  return (
    <Link
      to="/configuracion"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sol-600 dark:text-slate-400 dark:hover:text-sol-400"
    >
      <ArrowLeft className="h-4 w-4" />
      Volver a Configuración
    </Link>
  );
}
