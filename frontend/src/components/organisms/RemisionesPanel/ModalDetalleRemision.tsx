import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { TablaArticulosDocumento } from '../../molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { Remision, RemisionDetalle, TONO_POR_ESTADO } from './RemisionesPanel';

export function ModalDetalleRemision({ remision, onClose, onImprimir }: { remision: Remision; onClose: () => void; onImprimir: () => void }) {
  const { data: detalle } = useQuery({
    queryKey: ['remision-detalle-ver', remision.id],
    queryFn: async () => (await apiClient.get<RemisionDetalle>(`/remisiones/${remision.id}`)).data,
  });

  return (
    <Modal titulo={`Remisión ${remision.numero}`} onClose={onClose} ancho="2xl">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <Badge tono={TONO_POR_ESTADO[remision.estado]}>{remision.estado}</Badge>
          {detalle?.fecha && (
            <p className="text-right text-sm text-slate-500 dark:text-slate-400">
              Fecha
              <br />
              <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(detalle.fecha).toLocaleDateString('es-DO')}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p className="text-slate-500 dark:text-slate-400">Cliente</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{remision.cliente?.nombre}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p className="text-slate-500 dark:text-slate-400">Bodega</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{detalle?.bodega?.nombre ?? '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variante="secundario" onClick={onImprimir}>
            Imprimir / descargar PDF
          </Button>
        </div>

        {!detalle ? <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p> : <TablaArticulosDocumento lineas={detalle.lineas} mostrarPrecios={false} />}
      </div>
    </Modal>
  );
}
