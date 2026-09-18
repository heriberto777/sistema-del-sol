import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { TablaArticulosDocumento } from '../../molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { BloqueTotalesDocumento } from '../../molecules/BloqueTotalesDocumento/BloqueTotalesDocumento';
import { Cotizacion, TONO_POR_ESTADO } from './CotizacionesPanel';

export function ModalDetalleCotizacion({
  cotizacion,
  onClose,
  onImprimir,
}: {
  cotizacion: Cotizacion;
  onClose: () => void;
  onImprimir: () => void;
}) {
  const { data: detalle } = useQuery({
    queryKey: ['cotizacion-detalle', cotizacion.id],
    queryFn: async () => (await apiClient.get<Cotizacion>(`/cotizaciones/${cotizacion.id}`)).data,
  });

  return (
    <Modal titulo={`Cotización ${cotizacion.numero}`} onClose={onClose} ancho="2xl">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <Badge tono={TONO_POR_ESTADO[cotizacion.estado]}>{cotizacion.estado}</Badge>
          <div className="text-right text-sm text-slate-500 dark:text-slate-400">
            {detalle?.createdAt && (
              <p>
                Fecha <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(detalle.createdAt).toLocaleDateString('es-DO')}</span>
              </p>
            )}
            <p>
              Válida hasta{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(cotizacion.fechaVigenciaHasta).toLocaleDateString('es-DO')}</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Cliente</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{cotizacion.cliente?.nombre}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variante="secundario" onClick={onImprimir}>
            Imprimir / descargar PDF
          </Button>
        </div>

        {!detalle ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <>
            <TablaArticulosDocumento lineas={detalle.lineas} />
            <BloqueTotalesDocumento subtotal={detalle.subtotal ?? 0} descuento={detalle.descuento} itbis={detalle.itbis ?? 0} total={detalle.total} />
          </>
        )}
      </div>
    </Modal>
  );
}
