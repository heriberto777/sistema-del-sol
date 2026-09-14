import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';

interface RenglonFacturaConsolidada {
  hitoId: string;
  hitoNombre: string;
  monto: number;
  tareasPendientes: number;
  puedeFacturar: boolean;
  motivo: string | null;
}

interface PrevisualizacionFacturaConsolidada {
  proyectoNombre: string;
  clienteNombre: string;
  hitos: RenglonFacturaConsolidada[];
  total: number;
}

/**
 * "Facturar todo" — una sola Factura para varios hitos del proyecto.
 * Mismo criterio que FacturarHitoModal: previsualiza con el mismo cálculo
 * que el backend va a usar al confirmar, y nunca deja confirmar un hito
 * bloqueado — acá directamente lo EXCLUYE del lote (se sigue pudiendo
 * facturar el resto) en vez de bloquear todo el botón.
 */
export function FacturarConsolidadoModal({
  proyectoId,
  confirmando,
  onConfirmar,
  onCancelar,
}: {
  proyectoId: string;
  confirmando: boolean;
  onConfirmar: (hitoIds: string[]) => void;
  onCancelar: () => void;
}) {
  const { data: preview, isLoading, error } = useQuery({
    queryKey: ['proyecto-facturar-consolidado-preview', proyectoId],
    queryFn: async () => (await apiClient.get<PrevisualizacionFacturaConsolidada>(`/admin/proyectos/${proyectoId}/hitos/previsualizar-factura-consolidada`)).data,
  });

  const listos = preview?.hitos.filter((h) => h.puedeFacturar) ?? [];

  return (
    <Modal titulo="Facturar todo — factura consolidada" onClose={onCancelar}>
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Calculando…</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{mensajeErrorApi(error, 'No se pudo calcular la factura consolidada.')}</p>}

        {preview && (
          <>
            {preview.hitos.length === 0 ? (
              <p className="text-sm text-slate-400">No hay hitos pendientes de facturar en este proyecto.</p>
            ) : (
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {preview.hitos.map((h) => (
                  <div
                    key={h.hitoId}
                    className={clsx(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
                      h.puedeFacturar ? 'border-slate-200 dark:border-slate-800' : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">{h.hitoNombre}</p>
                      {!h.puedeFacturar && <p className="text-xs text-amber-700 dark:text-amber-400">{h.motivo} — se excluye del lote</p>}
                    </div>
                    <span className={clsx('shrink-0 font-medium', h.puedeFacturar ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through')}>
                      RD$ {h.monto.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
              <span>Total a facturar ({listos.length} hito(s))</span>
              <span>RD$ {preview.total.toLocaleString('es-DO', { maximumFractionDigits: 2 })}</span>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirmar(listos.map((h) => h.hitoId))} disabled={confirmando || isLoading || listos.length === 0}>
            {confirmando ? 'Facturando…' : `Confirmar factura consolidada (${listos.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
