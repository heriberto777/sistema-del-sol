import clsx from 'clsx';
import { CheckCircle2, Circle } from 'lucide-react';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';
import { RequierePermiso } from '../RequierePermiso/RequierePermiso';
import { ETIQUETA_ESTADO_HITO, ETIQUETA_ESTADO_TAREA, Hito, Tarea } from '../../../types/proyectos';

/**
 * Al hacer clic en un hito hoy no pasaba nada — este es el detalle: el
 * checklist de sus tareas (mismo dato que ya calcula `progresoHito` en
 * ProyectoHitosTab, acá tarea por tarea) y las MISMAS acciones que ya
 * tenía la fila (Editar/Facturar/Eliminar) — delegadas al padre, sin
 * duplicar ninguna mutation acá.
 */
export function HitoDetalleModal({
  hito,
  tareas,
  onClose,
  onEditar,
  onFacturar,
  onEliminar,
}: {
  hito: Hito;
  tareas: Tarea[];
  onClose: () => void;
  onEditar: () => void;
  onFacturar: () => void;
  onEliminar: () => void;
}) {
  const delHito = tareas.filter((t) => t.hitoId === hito.id);
  const terminadas = delHito.filter((t) => t.estado === 'TERMINADA').length;

  return (
    <Modal titulo={hito.nombre} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {ETIQUETA_ESTADO_HITO[hito.estado]}
          </span>
          {hito.fechaObjetivo && <span>Vence {new Date(hito.fechaObjetivo).toLocaleDateString('es-DO')}</span>}
          {hito.montoFijo && <span>RD$ {Number(hito.montoFijo).toLocaleString('es-DO')}</span>}
          {hito.facturaId && <span className="text-emerald-600 dark:text-emerald-400">Ya facturado</span>}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Tareas
            {delHito.length > 0 && (
              <span className="ml-1 font-normal text-slate-400">
                ({terminadas}/{delHito.length})
              </span>
            )}
          </h3>
          {delHito.length === 0 ? (
            <p className="text-sm text-slate-400">Sin tareas asignadas a este hito todavía.</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {delHito.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-sm dark:border-slate-800">
                  {t.estado === 'TERMINADA' ? (
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                  ) : (
                    <Circle size={15} className="shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className={clsx('flex-1 truncate', t.estado === 'TERMINADA' && 'text-slate-400 line-through')}>{t.titulo}</span>
                  <span className="shrink-0 text-xs text-slate-400">{ETIQUETA_ESTADO_TAREA[t.estado]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <RequierePermiso permiso="proyectos.editar">
            <Button type="button" variante="secundario" onClick={onEditar}>
              Editar
            </Button>
          </RequierePermiso>
          {!hito.facturaId && (
            <RequierePermiso permiso="proyectos.facturar">
              <Button type="button" variante="secundario" onClick={onFacturar}>
                Facturar
              </Button>
            </RequierePermiso>
          )}
          <RequierePermiso permiso="proyectos.editar">
            <Button type="button" variante="peligro" onClick={onEliminar}>
              Eliminar
            </Button>
          </RequierePermiso>
          <Button type="button" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
