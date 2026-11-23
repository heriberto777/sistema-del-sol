import { useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { usePeriodoTrabajo } from '../../../hooks/usePeriodoTrabajo';
import { Button } from '../../atoms/Button/Button';

function fechaCorta(iso: string) {
  // new Date('2026-11-23') se interpreta en UTC — sumar la hora local
  // evitaría correrse un día, pero acá alcanza con parsear como fecha
  // "plana" (mismo criterio que el resto de fechas sueltas sin hora).
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * docs/PLAN.md — "Período de trabajo + advertencia blanda". Widget del
 * header (al lado de Bandeja de WhatsApp/Crear nuevo) para ver/cambiar la
 * fecha que los formularios con fecha manual (Asiento, Gasto Rápido,
 * Gasto Menor, Factura de Proveedor, Depósito Bancario, Pagos) precargan
 * por defecto — puramente UX, no es un control de acceso.
 */
export function PeriodoTrabajoWidget() {
  const { fecha, setFecha, volverAHoy, esHoy } = usePeriodoTrabajo();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Período de trabajo — fecha que precargan los formularios nuevos"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
      >
        <CalendarClock size={16} className={esHoy ? 'text-slate-400' : 'text-amber-500'} />
        <span className="hidden sm:inline">{esHoy ? 'Hoy' : fechaCorta(fecha)}</span>
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Período de trabajo</p>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Fecha que se precarga en Asiento manual, Gasto Rápido, Gasto Menor, Factura de Proveedor, Depósito Bancario y los pagos — útil
            para cargar varios documentos seguidos de un mismo día sin repetirla a mano.
          </p>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          {!esHoy && (
            <Button type="button" variante="secundario" className="w-full" onClick={volverAHoy}>
              Volver a hoy
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
