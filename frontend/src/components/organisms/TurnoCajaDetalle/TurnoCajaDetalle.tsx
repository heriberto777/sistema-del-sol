import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Input } from '../../atoms/Input/Input';
import { FormField } from '../../molecules/FormField/FormField';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

type EstadoTurno = 'ABIERTO' | 'CERRADO';
type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

interface Cliente {
  id: string;
  nombre: string;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
}

interface MovimientoCaja {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA';
  monto: string;
  concepto: string;
}

interface FacturaTurno {
  id: string;
  total: string;
  metodoPago: MetodoPago | null;
  estado: string;
}

interface TurnoCajaDetalleData {
  id: string;
  bodegaId: string;
  montoInicial: string;
  montoFinalContado: string | null;
  montoEsperado: string | null;
  diferencia: string | null;
  estado: EstadoTurno;
  movimientos: MovimientoCaja[];
  facturas: FacturaTurno[];
}

function formatoRD(valor: string | number) {
  return `RD$ ${Number(valor).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

export function TurnoCajaDetalle({ turnoId }: { turnoId: string }) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [clienteId, setClienteId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO');
  const [tipoMovimiento, setTipoMovimiento] = useState<'ENTRADA' | 'SALIDA'>('SALIDA');
  const [montoMovimiento, setMontoMovimiento] = useState('');
  const [conceptoMovimiento, setConceptoMovimiento] = useState('');
  const [montoFinalContado, setMontoFinalContado] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pos-turno', turnoId],
    queryFn: async () => (await apiClient.get<TurnoCajaDetalleData>(`/pos/turnos/${turnoId}`)).data,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes-selector'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { tamanoPagina: 100 } })).data,
  });

  const { data: productos } = useQuery({
    queryKey: ['productos-selector'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['pos-turno', turnoId] });
    queryClient.invalidateQueries({ queryKey: ['pos-turnos'] });
  }

  const registrarVenta = useMutation({
    mutationFn: async () =>
      apiClient.post('/pos/ventas', {
        turnoCajaId: turnoId,
        clienteId,
        metodoPago,
        lineas: [{ productoId, cantidad: Number(cantidad) }],
      }),
    onSuccess: () => {
      invalidar();
      setProductoId('');
      setCantidad('1');
      setError(null);
    },
    onError: () => setError('No se pudo registrar la venta — revisá el stock disponible.'),
  });

  const registrarMovimiento = useMutation({
    mutationFn: async () =>
      apiClient.post(`/pos/turnos/${turnoId}/movimientos`, { tipo: tipoMovimiento, monto: Number(montoMovimiento), concepto: conceptoMovimiento }),
    onSuccess: () => {
      invalidar();
      setMontoMovimiento('');
      setConceptoMovimiento('');
      setError(null);
    },
  });

  const cerrarTurno = useMutation({
    mutationFn: async () => apiClient.post(`/pos/turnos/${turnoId}/cerrar`, { montoFinalContado: Number(montoFinalContado) }),
    onSuccess: () => {
      invalidar();
      setError(null);
    },
  });

  if (isLoading || !data) return <p className="text-sm text-slate-500">Cargando turno…</p>;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Turno de caja</h2>
        <Badge tono={data.estado === 'ABIERTO' ? 'exito' : 'neutro'}>{data.estado}</Badge>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data.estado === 'ABIERTO' && tienePermiso('pos.editar') && (
        <>
          <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Venta rápida</h3>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                registrarVenta.mutate();
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Cliente…</option>
                {clientes?.datos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <select
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
                required
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Producto…</option>
                {productos?.datos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nombre}
                  </option>
                ))}
              </select>
              <Input type="number" min={0.01} step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-24" />
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
              <Button type="submit" disabled={registrarVenta.isPending}>
                {registrarVenta.isPending ? 'Vendiendo…' : 'Vender'}
              </Button>
            </form>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Movimiento de efectivo (no venta)</h3>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                registrarMovimiento.mutate();
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <select
                value={tipoMovimiento}
                onChange={(e) => setTipoMovimiento(e.target.value as 'ENTRADA' | 'SALIDA')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="SALIDA">Salida (retiro)</option>
                <option value="ENTRADA">Entrada</option>
              </select>
              <Input type="number" min={0.01} step="any" placeholder="Monto" value={montoMovimiento} onChange={(e) => setMontoMovimiento(e.target.value)} className="w-32" />
              <Input placeholder="Concepto" value={conceptoMovimiento} onChange={(e) => setConceptoMovimiento(e.target.value)} className="w-56" />
              <Button type="submit" variante="secundario" disabled={registrarMovimiento.isPending}>
                Registrar
              </Button>
            </form>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Cerrar turno</h3>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                cerrarTurno.mutate();
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <FormField
                id="turno-monto-final"
                label="Efectivo contado"
                type="number"
                min={0}
                step="any"
                value={montoFinalContado}
                onChange={(e) => setMontoFinalContado(e.target.value)}
                required
                className="w-40"
              />
              <Button type="submit" variante="peligro" disabled={cerrarTurno.isPending}>
                {cerrarTurno.isPending ? 'Cerrando…' : 'Cerrar turno'}
              </Button>
            </form>
          </div>
        </>
      )}

      {data.estado === 'CERRADO' && (
        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
          <p>Esperado: {formatoRD(data.montoEsperado ?? 0)}</p>
          <p>Contado: {formatoRD(data.montoFinalContado ?? 0)}</p>
          <p>Diferencia: {formatoRD(data.diferencia ?? 0)}</p>
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <h3 className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Ventas del turno</h3>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {data.facturas.map((f) => (
            <li key={f.id}>
              {formatoRD(f.total)} — {f.metodoPago ?? '—'} ({f.estado})
            </li>
          ))}
          {data.facturas.length === 0 && <li className="text-slate-400">Sin ventas todavía</li>}
        </ul>
      </div>

      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <h3 className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Movimientos de efectivo</h3>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {data.movimientos.map((m) => (
            <li key={m.id}>
              {m.tipo} {formatoRD(m.monto)} — {m.concepto}
            </li>
          ))}
          {data.movimientos.length === 0 && <li className="text-slate-400">Sin movimientos todavía</li>}
        </ul>
      </div>
    </div>
  );
}
