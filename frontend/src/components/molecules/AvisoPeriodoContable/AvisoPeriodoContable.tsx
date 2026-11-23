import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { usePeriodoVigente } from '../../../hooks/usePeriodoVigente';

/**
 * Aviso que solo aparece cuando hay un problema real: ningún
 * `PeriodoContable` cubre la fecha de hoy (el cron que crea el del mes
 * siguiente, `PeriodosContablesCronService`, no reintenta ejecuciones
 * perdidas — ver el comentario de `usePeriodoVigente`). Sin este aviso,
 * el primer indicio del problema era un 400 genérico al intentar
 * facturar/comprar/pagar nómina/registrar un gasto, sin ninguna pista de
 * qué hacer. No se puede "descartar" — refleja un bloqueo real de
 * operación, no una notificación informativa.
 */
export function AvisoPeriodoContable() {
  const { hayPeriodoVigente, cargando } = usePeriodoVigente();

  if (cargando || hayPeriodoVigente) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
      <AlertTriangle size={18} className="shrink-0" />
      <span className="flex-1">
        No hay ningún período contable que cubra la fecha de hoy — esta operación va a fallar hasta que se cree. Andá a{' '}
        <Link to="/contabilidad/cierre" className="font-semibold underline">
          Contabilidad → Cierre de período
        </Link>{' '}
        y usá "Completar períodos faltantes".
      </span>
    </div>
  );
}
