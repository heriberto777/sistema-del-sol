import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Modal } from '../Modal/Modal';
import { FormField } from '../FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Proveedor {
  id: string;
  nombre: string;
}

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

const TIPOS_NCF_PROVEEDOR = [
  { valor: 'B01', etiqueta: 'B01 — Crédito Fiscal' },
  { valor: 'B02', etiqueta: 'B02 — Consumo' },
  { valor: 'B14', etiqueta: 'B14 — Régimen Especial' },
  { valor: 'B15', etiqueta: 'B15 — Gubernamental' },
  { valor: 'E31', etiqueta: 'E31 — Crédito Fiscal Electrónico' },
  { valor: 'E32', etiqueta: 'E32 — Consumo Electrónico' },
  { valor: 'E44', etiqueta: 'E44 — Régimen Especial Electrónico' },
  { valor: 'E45', etiqueta: 'E45 — Gubernamental Electrónico' },
];

const LINEA_VACIA = { cuentaContableId: '', concepto: '', valor: '', porcentajeItbis: '18', cantidad: '1' };

/**
 * Factura de un proveedor a crédito SIN orden de compra (luz, alquiler,
 * servicios profesionales) — genera su propia CuentaPorPagar, igual que
 * ComprasService.recibir() con una recepción. Multi-línea como Gastos
 * Menores, para poder clasificar la misma factura contra varias cuentas.
 */
export function ModalCrearFacturaProveedor({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [proveedorId, setProveedorId] = useState('');
  const [ncfProveedor, setNcfProveedor] = useState('');
  const [tipoNcfProveedor, setTipoNcfProveedor] = useState('B01');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState('');
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }]);
  const [error, setError] = useState<string | null>(null);

  const { data: proveedores } = useQuery({
    queryKey: ['proveedores-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Proveedor>>('/proveedores', { params: { tamanoPagina: 200 } })).data.datos,
  });
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
    const cantidad = Number(l.cantidad) || 1;
    const itbis = Number(l.porcentajeItbis) || 0;
    return acc + valor * cantidad * (1 + itbis / 100);
  }, 0);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/facturas-proveedor', {
        proveedorId,
        ncfProveedor,
        tipoNcfProveedor,
        concepto: concepto || undefined,
        fecha: fecha || undefined,
        lineas: lineas
          .filter((l) => l.cuentaContableId && l.valor)
          .map((l) => ({
            cuentaContableId: l.cuentaContableId,
            concepto: l.concepto || undefined,
            valor: Number(l.valor),
            porcentajeItbis: l.porcentajeItbis ? Number(l.porcentajeItbis) : undefined,
            cantidad: l.cantidad ? Number(l.cantidad) : undefined,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas-proveedor'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-pagar-resumen'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la factura de proveedor. Revisa los datos.')),
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
    <Modal titulo="Nueva factura de proveedor" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Proveedor</label>
          <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {proveedores?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FormField
            id="fp-ncf"
            label="NCF del proveedor"
            placeholder="B0100000001"
            value={ncfProveedor}
            onChange={(e) => setNcfProveedor(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de comprobante</label>
            <Select value={tipoNcfProveedor} onChange={(e) => setTipoNcfProveedor(e.target.value)} required>
              {TIPOS_NCF_PROVEEDOR.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <FormField id="fp-concepto" label="Concepto (opcional)" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        <FormField id="fp-fecha" label="Fecha (opcional)" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuentas contables</p>
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
              <input
                type="number"
                min={1}
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                className="w-16 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
          Total estimado: RD$ {totalEstimado.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Registrando…' : 'Registrar factura'}
        </Button>
      </form>
    </Modal>
  );
}
