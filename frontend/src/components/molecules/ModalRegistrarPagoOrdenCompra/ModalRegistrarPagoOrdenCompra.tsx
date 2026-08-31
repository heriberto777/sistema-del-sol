import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../Modal/Modal';
import { FormField } from '../FormField/FormField';
import { SelectFormaPago } from '../SelectFormaPago/SelectFormaPago';
import { Button } from '../../atoms/Button/Button';

interface Pago {
  id: string;
  monto: string;
  formaPago: { nombre: string };
  fecha: string;
}

/**
 * Extraído de Compras.tsx (era privado ahí) para reusarlo también desde
 * Cuentas por Pagar (mismo criterio que ModalRegistrarCobro, extraído de
 * FacturasTable para Cuentas por Cobrar) — sin cambios de comportamiento.
 */
export function ModalRegistrarPagoOrdenCompra({
  orden,
  onClose,
}: {
  orden: { id: string; numero: string; total: string };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState('');
  const [formaPagoId, setFormaPagoId] = useState('');
  const [aplicaRetencion, setAplicaRetencion] = useState(false);
  const [retencionIsr, setRetencionIsr] = useState('');
  const [retencionItbis, setRetencionItbis] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: historial } = useQuery({
    queryKey: ['pagos-orden-compra', orden.id],
    queryFn: async () => (await apiClient.get<{ pagos: Pago[]; totalPagado: number }>(`/compras/${orden.id}/pagos`)).data,
  });

  const totalPagado = historial ? Number(historial.totalPagado) : 0;
  const pendiente = Number(orden.total) - totalPagado;
  const netoAPagar = aplicaRetencion ? Number(monto || 0) - Number(retencionIsr || 0) - Number(retencionItbis || 0) : Number(monto || 0);

  const registrar = useMutation({
    mutationFn: async () =>
      apiClient.post(`/compras/${orden.id}/pagos`, {
        monto: Number(monto),
        formaPagoId,
        ...(aplicaRetencion && Number(retencionIsr) > 0 ? { retencionIsr: Number(retencionIsr) } : {}),
        ...(aplicaRetencion && Number(retencionItbis) > 0 ? { retencionItbis: Number(retencionItbis) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos-orden-compra', orden.id] });
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-pagar'] });
      setMonto('');
      setAplicaRetencion(false);
      setRetencionIsr('');
      setRetencionItbis('');
      setError(null);
    },
    onError: () => setError('No se pudo registrar el pago. Revisa el monto.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    registrar.mutate();
  }

  return (
    <Modal titulo={`Registrar pago — orden ${orden.numero}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <p>Total: RD$ {Number(orden.total).toLocaleString('es-DO')}</p>
          <p>Pagado: RD$ {totalPagado.toLocaleString('es-DO')}</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">Pendiente: RD$ {pendiente.toLocaleString('es-DO')}</p>
        </div>

        {historial && historial.pagos.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Historial de pagos</p>
            <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
              {historial.pagos.map((pago) => (
                <li key={pago.id}>
                  RD$ {Number(pago.monto).toLocaleString('es-DO')} — {pago.formaPago.nombre} —{' '}
                  {new Date(pago.fecha).toLocaleDateString('es-DO')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pendiente > 0 ? (
          <form onSubmit={onSubmit} className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <FormField
              id="pago-oc-monto"
              label="Monto a pagar"
              type="number"
              min={0}
              max={pendiente}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Forma de pago</label>
              <SelectFormaPago value={formaPagoId} onChange={setFormaPagoId} />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={aplicaRetencion} onChange={(e) => setAplicaRetencion(e.target.checked)} />
              Aplica retención de ISR/ITBIS al proveedor
            </label>
            {aplicaRetencion && (
              <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lo retenido no se le paga al proveedor — se declara luego a la DGII. Ver tasas de referencia en Admin →
                  Configuración general.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    id="pago-oc-retencion-isr"
                    label="Retención ISR (RD$)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={retencionIsr}
                    onChange={(e) => setRetencionIsr(e.target.value)}
                  />
                  <FormField
                    id="pago-oc-retencion-itbis"
                    label="Retención ITBIS (RD$)"
                    type="number"
                    min={0}
                    step="0.01"
                    value={retencionItbis}
                    onChange={(e) => setRetencionItbis(e.target.value)}
                  />
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Neto a pagar al proveedor: RD$ {netoAPagar.toLocaleString('es-DO')}
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={registrar.isPending} className="w-full">
              {registrar.isPending ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">Esta orden ya está pagada en su totalidad.</p>
        )}
      </div>
    </Modal>
  );
}
