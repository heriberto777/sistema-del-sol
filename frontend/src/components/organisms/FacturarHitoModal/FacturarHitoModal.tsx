import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';

interface PrevisualizacionFacturaHito {
  proyectoNombre: string;
  clienteNombre: string;
  hitoNombre: string;
  modoFacturacion: string;
  monto: number;
  horas?: number;
  tarifaHora?: number;
  tareasPendientes: number;
  puedeFacturar: boolean;
}

interface FacturarHitoModalProps {
  hitoId: string;
  confirmando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Punto 4 del pedido del usuario (2026-09-10) — antes de facturar un hito
 * de verdad, un modal con la información a validar (mismo cálculo que
 * `facturarHito`, vía `GET .../previsualizar-factura`). El botón de
 * confirmar queda deshabilitado si `puedeFacturar` es falso — punto 5,
 * "la más importante": hito con tareas sin terminar no se puede facturar
 * (la validación real, no saltable, sigue siendo la del backend).
 */
export function FacturarHitoModal({ hitoId, confirmando, onConfirmar, onCancelar }: FacturarHitoModalProps) {
  const { data: preview, isLoading, error } = useQuery({
    queryKey: ['proyecto-hito-previsualizar-factura', hitoId],
    queryFn: async () => (await apiClient.get<PrevisualizacionFacturaHito>(`/admin/proyectos/hitos/${hitoId}/previsualizar-factura`)).data,
  });

  return (
    <Modal titulo="Confirmar factura del hito" onClose={onCancelar}>
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Calculando…</p>}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{mensajeErrorApi(error, 'No se pudo calcular la factura de este hito.')}</p>}

        {preview && (
          <>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Proyecto</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{preview.proyectoNombre}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Cliente</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{preview.clienteNombre}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">Hito</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{preview.hitoNombre}</dd>
              </div>
              {preview.modoFacturacion === 'POR_HORAS' && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Horas × tarifa</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">
                    {preview.horas} h × RD$ {Number(preview.tarifaHora).toLocaleString('es-DO')}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                <dt className="text-slate-500 dark:text-slate-400">Monto a facturar (antes de ITBIS)</dt>
                <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  RD$ {preview.monto.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                </dd>
              </div>
            </dl>

            {!preview.puedeFacturar && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Este hito tiene {preview.tareasPendientes} tarea(s) sin terminar — no se puede facturar hasta que todas estén Terminadas.
              </p>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirmar} disabled={confirmando || isLoading || !preview?.puedeFacturar}>
            {confirmando ? 'Facturando…' : 'Confirmar y facturar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
