import { usePeriodoTrabajo } from '../../../hooks/usePeriodoTrabajo';

function mesAnio(iso: string) {
  return iso.slice(0, 7); // 'YYYY-MM' — comparar así evita líos de zona horaria con new Date().
}

/**
 * docs/PLAN.md — "advertencia blanda": si la fecha elegida en el
 * formulario cae en un mes distinto al del período de trabajo activo, lo
 * avisa sin bloquear nada — la única validación dura real sigue siendo
 * `validarPeriodoAbierto` en el backend. `fecha` vacía no avisa (el
 * formulario validará que sea obligatoria por su cuenta, si corresponde).
 */
export function AvisoFechaPeriodoTrabajo({ fecha }: { fecha: string }) {
  const { fecha: periodoTrabajo } = usePeriodoTrabajo();

  if (!fecha || mesAnio(fecha) === mesAnio(periodoTrabajo)) return null;

  return (
    <p className="text-xs text-amber-600 dark:text-amber-400">
      Tu período de trabajo es otro mes — revisá que esta fecha sea la que querés.
    </p>
  );
}
