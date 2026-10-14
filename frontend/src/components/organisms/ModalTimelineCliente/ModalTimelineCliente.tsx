import { useQuery } from '@tanstack/react-query';
import { MessageCircle, FileText, Receipt, Star } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { EntradaTimeline, TipoEntradaTimeline } from '../../../types/crm';
import { ActividadesCrmPanel } from '../ActividadesCrmPanel/ActividadesCrmPanel';

const ICONO_POR_TIPO: Record<TipoEntradaTimeline, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  lealtad: Star,
  cotizacion: FileText,
  factura: Receipt,
};

const COLOR_POR_TIPO: Record<TipoEntradaTimeline, string> = {
  whatsapp: 'text-emerald-600 dark:text-emerald-400',
  lealtad: 'text-amber-600 dark:text-amber-400',
  cotizacion: 'text-sol-600 dark:text-sol-400',
  factura: 'text-slate-600 dark:text-slate-400',
};

const ETIQUETA_POR_TIPO: Record<TipoEntradaTimeline, string> = {
  whatsapp: 'WhatsApp',
  lealtad: 'Lealtad',
  cotizacion: 'Cotización',
  factura: 'Factura',
};

/**
 * Ficha 360° (Fase 2) — mezcla WhatsApp (join por teléfono, sin FK real
 * — ver el backend), Lealtad, Cotizaciones y Facturas de un Cliente en un
 * solo feed. El feed en sí es de solo lectura (para eso están las
 * pantallas de cada módulo); el bloque de "Actividades CRM" debajo (Fase
 * 3) sí tiene acciones — es donde el vendedor ve y usa un pedido sugerido
 * por WhatsApp cuando el teléfono ya es un Cliente real (si no se
 * mostrara acá, no tendría ninguna otra pantalla donde verlo).
 */
export function ModalTimelineCliente({ clienteId, nombreCliente, onClose }: { clienteId: string; nombreCliente: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-timeline-cliente', clienteId],
    queryFn: async () => (await apiClient.get<EntradaTimeline[]>(`/crm/clientes/${clienteId}/timeline`)).data,
  });

  return (
    <Modal titulo={`Timeline — ${nombreCliente}`} onClose={onClose} ancho="xl">
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {!isLoading && data?.length === 0 && (
        <EstadoVacio titulo="Sin actividad" descripcion="Todavía no hay WhatsApp, cotizaciones, facturas ni movimientos de lealtad para este cliente." />
      )}
      <div className="flex flex-col gap-3">
        {data?.map((entrada, i) => {
          const Icono = ICONO_POR_TIPO[entrada.tipo];
          return (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <Icono size={16} className={`mt-0.5 shrink-0 ${COLOR_POR_TIPO[entrada.tipo]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${COLOR_POR_TIPO[entrada.tipo]}`}>{ETIQUETA_POR_TIPO[entrada.tipo]}</span>
                  <span className="text-xs text-slate-400">{new Date(entrada.fecha).toLocaleString('es-DO')}</span>
                  {entrada.meta?.rol === 'ASISTENTE' && <span className="text-xs text-slate-400">· bot</span>}
                  {entrada.meta?.rol === 'HUMANO' && <span className="text-xs text-slate-400">· respuesta del equipo</span>}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{entrada.resumen}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Actividades CRM</h3>
        <ActividadesCrmPanel referencia={{ clienteId }} />
      </div>
    </Modal>
  );
}
