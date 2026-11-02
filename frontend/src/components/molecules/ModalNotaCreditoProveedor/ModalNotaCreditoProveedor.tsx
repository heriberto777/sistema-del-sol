import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Modal } from '../Modal/Modal';
import { FormField } from '../FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface FacturaProveedorBasica {
  id: string;
  ncfProveedor: string;
  proveedorId: string;
}

const LINEA_VACIA = { cuentaContableId: '', concepto: '', valor: '', porcentajeItbis: '18' };

/**
 * Ajuste financiero puro sobre una FacturaProveedor ya registrada — reduce
 * el saldo real de su CuentaPorPagar (no tiene CxP propia). Una vez creada
 * no se puede anular (ver FacturasProveedorService.anular).
 */
export function ModalNotaCreditoProveedor({ factura, onClose }: { factura: FacturaProveedorBasica; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [ncfProveedor, setNcfProveedor] = useState('');
  const [concepto, setConcepto] = useState('');
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }]);
  const [error, setError] = useState<string | null>(null);

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas-gasto'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });
  const cuentasGasto = (cuentas ?? []).filter((c) => c.tipo === 'GASTO');

  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const totalEstimado = lineas.reduce((acc, l) => {
    const valor = Number(l.valor) || 0;
    const itbis = Number(l.porcentajeItbis) || 0;
    return acc + valor * (1 + itbis / 100);
  }, 0);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/facturas-proveedor', {
        proveedorId: factura.proveedorId,
        tipo: 'NOTA_CREDITO',
        facturaOrigenId: factura.id,
        ncfProveedor,
        tipoNcfProveedor: 'B04',
        concepto: concepto || undefined,
        lineas: lineas
          .filter((l) => l.cuentaContableId && l.valor)
          .map((l) => ({
            cuentaContableId: l.cuentaContableId,
            concepto: l.concepto || undefined,
            valor: Number(l.valor),
            porcentajeItbis: l.porcentajeItbis ? Number(l.porcentajeItbis) : undefined,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas-proveedor'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-pagar-resumen'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la nota de crédito. Revisa que no exceda el saldo pendiente.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.filter((l) => l.cuentaContableId && l.valor).length === 0) {
      setError('Agregá al menos una línea con cuenta contable y valor.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo={`Nota de crédito — factura ${factura.ncfProveedor}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField
          id="nc-ncf"
          label="NCF de la nota de crédito (emitida por el proveedor)"
          placeholder="B0400000001"
          value={ncfProveedor}
          onChange={(e) => setNcfProveedor(e.target.value)}
          required
        />
        <FormField id="nc-concepto" label="Motivo (opcional)" value={concepto} onChange={(e) => setConcepto(e.target.value)} />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuentas contables a ajustar</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Select
                value={linea.cuentaContableId}
                onChange={(e) => actualizarLinea(i, { cuentaContableId: e.target.value })}
                required
                className="min-w-[10rem] flex-1"
              >
                <option value="">Cuenta de gasto…</option>
                {cuentasGasto.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </Select>
              <input
                type="text"
                placeholder="Concepto"
                value={linea.concepto}
                onChange={(e) => actualizarLinea(i, { concepto: e.target.value })}
                className="w-32 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Valor"
                value={linea.valor}
                onChange={(e) => actualizarLinea(i, { valor: e.target.value })}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder="ITBIS %"
                value={linea.porcentajeItbis}
                onChange={(e) => actualizarLinea(i, { porcentajeItbis: e.target.value })}
                className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {lineas.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  aria-label="Quitar línea"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}
            className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Agregar cuenta contable
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Total de la nota: RD$ {totalEstimado.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Registrando…' : 'Registrar nota de crédito'}
        </Button>
      </form>
    </Modal>
  );
}
