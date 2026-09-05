import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
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
 * Extraído de FacturasTable (era privado ahí) para reusarlo también desde
 * Cuentas por Cobrar (ítem Cobranza) — mismo comportamiento, sin cambios.
 * Cobro factura por factura (decisión confirmada con el usuario, sin
 * "abono general"/FIFO multi-factura como Cuadre).
 */
export function ModalRegistrarCobro({
  factura,
  onClose,
}: {
  factura: { id: string; numero: string | null; ncf: string | null; total: string };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [monto, setMonto] = useState('');
  const [formaPagoId, setFormaPagoId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: historial } = useQuery({
    queryKey: ['pagos-factura', factura.id],
    queryFn: async () => (await apiClient.get<{ pagos: Pago[]; totalPagado: number }>(`/facturas/${factura.id}/pagos`)).data,
  });

  const totalPagado = historial ? Number(historial.totalPagado) : 0;
  const pendiente = Number(factura.total) - totalPagado;

  const registrar = useMutation({
    mutationFn: async () => apiClient.post(`/facturas/${factura.id}/pagos`, { monto: Number(monto), formaPagoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos-factura', factura.id] });
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-cobrar'] });
      setMonto('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar el cobro. Revisa el monto.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    registrar.mutate();
  }

  return (
    <Modal titulo={`Registrar cobro — ${factura.numero ?? factura.ncf ?? factura.id.slice(0, 8)}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <p>Total: RD$ {Number(factura.total).toLocaleString('es-DO')}</p>
          <p>Pagado: RD$ {totalPagado.toLocaleString('es-DO')}</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">Pendiente: RD$ {pendiente.toLocaleString('es-DO')}</p>
        </div>

        {historial && historial.pagos.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Historial de cobros</p>
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
              id="cobro-monto"
              label="Monto a cobrar"
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={registrar.isPending} className="w-full">
              {registrar.isPending ? 'Registrando…' : 'Registrar cobro'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Esta factura ya está pagada en su totalidad.</p>
        )}
      </div>
    </Modal>
  );
}
