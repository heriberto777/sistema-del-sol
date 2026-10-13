import { Modal } from '../../molecules/Modal/Modal';
import { Badge } from '../../atoms/Badge/Badge';
import { ActividadesCrmPanel } from '../ActividadesCrmPanel/ActividadesCrmPanel';
import { Oportunidad } from '../../../types/crm';

const TONO_ESTADO: Record<Oportunidad['estado'], 'neutro' | 'exito' | 'peligro'> = { ABIERTA: 'neutro', GANADA: 'exito', PERDIDA: 'peligro' };

export function ModalDetalleOportunidad({ oportunidad, onClose }: { oportunidad: Oportunidad; onClose: () => void }) {
  return (
    <Modal titulo={oportunidad.titulo} onClose={onClose} ancho="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tono={TONO_ESTADO[oportunidad.estado]}>{oportunidad.estado}</Badge>
          <span className="text-xs text-slate-400">
            Etapa: {oportunidad.etapa.nombre} · {oportunidad.probabilidadPct}% de probabilidad
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{oportunidad.cliente ? 'Cliente' : 'Lead'}</span>
            <p className="text-slate-700 dark:text-slate-300">{oportunidad.cliente?.nombre ?? oportunidad.lead?.nombre ?? '—'}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Vendedor</span>
            <p className="text-slate-700 dark:text-slate-300">{oportunidad.vendedor.nombre}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Monto estimado</span>
            <p className="font-mono text-slate-700 dark:text-slate-300">RD$ {Number(oportunidad.montoEstimado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Cierre estimado</span>
            <p className="text-slate-700 dark:text-slate-300">{new Date(oportunidad.fechaCierreEstimada).toLocaleDateString('es-DO')}</p>
          </div>
        </div>

        {oportunidad.estado === 'PERDIDA' && oportunidad.motivoPerdida && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
            Motivo: {oportunidad.motivoPerdida}
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Actividades</h3>
          <ActividadesCrmPanel referencia={{ oportunidadId: oportunidad.id }} />
        </div>
      </div>
    </Modal>
  );
}
