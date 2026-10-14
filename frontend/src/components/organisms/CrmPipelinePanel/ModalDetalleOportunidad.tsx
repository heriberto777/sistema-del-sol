import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../molecules/Modal/Modal';
import { Badge } from '../../atoms/Badge/Badge';
import { ActividadesCrmPanel } from '../ActividadesCrmPanel/ActividadesCrmPanel';
import { ModalTimelineCliente } from '../ModalTimelineCliente/ModalTimelineCliente';
import { Button } from '../../atoms/Button/Button';
import { ETIQUETA_ESTADO_COTIZACION_CRM, Oportunidad } from '../../../types/crm';

const TONO_ESTADO: Record<Oportunidad['estado'], 'neutro' | 'exito' | 'peligro'> = { ABIERTA: 'neutro', GANADA: 'exito', PERDIDA: 'peligro' };
const TONO_ESTADO_COTIZACION: Record<string, 'neutro' | 'exito' | 'peligro' | 'advertencia'> = {
  BORRADOR: 'neutro',
  ENVIADA: 'advertencia',
  ACEPTADA: 'exito',
  RECHAZADA: 'peligro',
  VENCIDA: 'peligro',
};

export function ModalDetalleOportunidad({ oportunidad, onClose }: { oportunidad: Oportunidad; onClose: () => void }) {
  const navigate = useNavigate();
  const [viendoTimeline, setViendoTimeline] = useState(false);

  return (
    <Modal titulo={oportunidad.titulo} onClose={onClose} ancho="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tono={TONO_ESTADO[oportunidad.estado]}>{oportunidad.estado}</Badge>
            <span className="text-xs text-slate-400">
              Etapa: {oportunidad.etapa.nombre} · {oportunidad.probabilidadPct}% de probabilidad
            </span>
          </div>
          {oportunidad.clienteId && (
            <button type="button" onClick={() => setViendoTimeline(true)} className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
              Ver timeline del cliente
            </button>
          )}
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

        {oportunidad.cotizacion && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-sol-200 bg-sol-50 p-3 text-sm dark:border-sol-900 dark:bg-sol-900/10">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sol-900 dark:text-sol-200">Cotización {oportunidad.cotizacion.numero}</span>
              <Badge tono={TONO_ESTADO_COTIZACION[oportunidad.cotizacion.estado]}>{ETIQUETA_ESTADO_COTIZACION_CRM[oportunidad.cotizacion.estado]}</Badge>
              <span className="font-mono text-sol-800 dark:text-sol-300">RD$ {Number(oportunidad.cotizacion.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>
            <Button variante="secundario" onClick={() => navigate('/cotizaciones')}>
              Ver en Cotizaciones
            </Button>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Actividades</h3>
          <ActividadesCrmPanel referencia={{ oportunidadId: oportunidad.id }} />
        </div>
      </div>

      {viendoTimeline && oportunidad.clienteId && (
        <ModalTimelineCliente
          clienteId={oportunidad.clienteId}
          nombreCliente={oportunidad.cliente?.nombre ?? oportunidad.lead?.nombre ?? ''}
          onClose={() => setViendoTimeline(false)}
        />
      )}
    </Modal>
  );
}
