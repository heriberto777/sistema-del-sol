import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
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
  porcentajeItbis: string;
}

interface Precio {
  precioVenta: string;
}

interface LineaCarrito {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  porcentajeItbis: number;
}

interface MovimientoCaja {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA';
  monto: string;
  concepto: string;
}

interface FacturaTurno {
  id: string;
  ncf: string | null;
  total: string;
  metodoPago: MetodoPago | null;
  estado: string;
}

interface Cajero {
  id: string;
  nombre: string;
}

interface TurnoCajaDetalleData {
  id: string;
  bodegaId: string;
  montoInicial: string;
  montoFinalContado: string | null;
  montoEsperado: string | null;
  diferencia: string | null;
  justificacionDiferencia: string | null;
  estado: EstadoTurno;
  cajero: Cajero;
  cerradoPor: Cajero | null;
  movimientos: MovimientoCaja[];
  facturas: FacturaTurno[];
}

function formatoRD(valor: string | number) {
  return `RD$ ${Number(valor).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

/** Réplica del cálculo de pos.service.ts:88 — solo para mostrar el esperado ANTES de cerrar; el backend sigue siendo la fuente de verdad final. */
function calcularMontoEsperado(data: TurnoCajaDetalleData): number {
  const ventasEfectivo = data.facturas
    .filter((f) => f.metodoPago === 'EFECTIVO' && f.estado === 'EMITIDA')
    .reduce((acc, f) => acc + Number(f.total), 0);
  const entradas = data.movimientos.filter((m) => m.tipo === 'ENTRADA').reduce((acc, m) => acc + Number(m.monto), 0);
  const salidas = data.movimientos.filter((m) => m.tipo === 'SALIDA').reduce((acc, m) => acc + Number(m.monto), 0);
  return Number(data.montoInicial) + ventasEfectivo + entradas - salidas;
}

export function TurnoCajaDetalle({ turnoId, onCerrado }: { turnoId: string; onCerrado?: () => void }) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO');
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [modalCerrarTurno, setModalCerrarTurno] = useState(false);
  const [ventaConfirmada, setVentaConfirmada] = useState<{ id: string; total: string } | null>(null);
  const [facturaAnulando, setFacturaAnulando] = useState<FacturaTurno | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facturaImprimiendo, setFacturaImprimiendo] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pos-turno', turnoId],
    queryFn: async () => (await apiClient.get<TurnoCajaDetalleData>(`/pos/turnos/${turnoId}`)).data,
  });

  const { data: consumidorFinal } = useQuery({
    queryKey: ['clientes-consumidor-final'],
    queryFn: async () => (await apiClient.get<Cliente | null>('/clientes/consumidor-final')).data,
  });

  useEffect(() => {
    if (!cliente && consumidorFinal) setCliente(consumidorFinal);
  }, [cliente, consumidorFinal]);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['pos-turno', turnoId] });
    queryClient.invalidateQueries({ queryKey: ['pos-turnos'] });
  }

  const registrarVenta = useMutation({
    mutationFn: async () =>
      apiClient.post('/pos/ventas', {
        turnoCajaId: turnoId,
        clienteId: cliente?.id,
        metodoPago,
        lineas: carrito.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
      }),
    onSuccess: (respuesta) => {
      invalidar();
      setCarrito([]);
      setError(null);
      setVentaConfirmada({ id: respuesta.data.id, total: respuesta.data.total });
    },
    onError: () => setError('No se pudo registrar la venta — revisá el stock disponible.'),
  });

  function agregarAlCarrito(linea: LineaCarrito) {
    setCarrito((prev) => {
      const existente = prev.find((l) => l.productoId === linea.productoId);
      if (existente) {
        return prev.map((l) => (l.productoId === linea.productoId ? { ...l, cantidad: l.cantidad + linea.cantidad } : l));
      }
      return [...prev, linea];
    });
  }

  function quitarDelCarrito(productoId: string) {
    setCarrito((prev) => prev.filter((l) => l.productoId !== productoId));
  }

  function cambiarCantidad(productoId: string, cantidad: number) {
    setCarrito((prev) => prev.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l)));
  }

  const subtotal = carrito.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
  const itbis = carrito.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario * l.porcentajeItbis) / 100, 0);
  const total = subtotal + itbis;

  function onCobrar() {
    setError(null);
    if (carrito.length === 0) {
      setError('Agregá al menos un producto al carrito.');
      return;
    }
    if (!cliente) {
      setError('Seleccioná un cliente (o dejá el Consumidor Final por defecto).');
      return;
    }
    registrarVenta.mutate();
  }

  if (isLoading || !data) return <p className="text-sm text-slate-500">Cargando turno…</p>;

  const descripcion =
    `Abierto por ${data.cajero.nombre}` +
    (data.estado === 'CERRADO' && data.cerradoPor && data.cerradoPor.id !== data.cajero.id ? ` — cerrado por ${data.cerradoPor.nombre}` : '');

  return (
    <Card
      titulo="Turno de caja"
      descripcion={descripcion}
      acciones={<Badge tono={data.estado === 'ABIERTO' ? 'exito' : 'neutro'}>{data.estado}</Badge>}
    >
      <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data.estado === 'ABIERTO' && tienePermiso('pos.editar') && (
        <>
          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Venta</h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</label>
              <ComboboxBusqueda<Cliente>
                valor={cliente}
                onSeleccionar={setCliente}
                obtenerId={(c) => c.id}
                obtenerEtiqueta={(c) => c.nombre}
                placeholder="Buscar cliente…"
                buscar={async (texto) =>
                  (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
                }
              />
            </div>

            <AgregarProducto onAgregar={agregarAlCarrito} />

            <div className="rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-1.5">Producto</th>
                    <th className="px-3 py-1.5">Cant.</th>
                    <th className="px-3 py-1.5">Precio</th>
                    <th className="px-3 py-1.5">Subtotal</th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {carrito.map((l) => (
                    <tr key={l.productoId}>
                      <td className="px-3 py-1.5">
                        {l.codigo} — {l.nombre}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          value={l.cantidad}
                          onChange={(e) => cambiarCantidad(l.productoId, Number(e.target.value))}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-1.5">{formatoRD(l.precioUnitario)}</td>
                      <td className="px-3 py-1.5">{formatoRD(l.cantidad * l.precioUnitario)}</td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => quitarDelCarrito(l.productoId)}
                          className="text-red-600 hover:text-red-700"
                          aria-label="Quitar del carrito"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {carrito.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                        Carrito vacío — agregá un producto arriba.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {carrito.length > 0 && (
              <div className="flex flex-col items-end gap-0.5 text-sm text-slate-600 dark:text-slate-400">
                <p>Subtotal: {formatoRD(subtotal)}</p>
                <p>ITBIS: {formatoRD(itbis)}</p>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Total: {formatoRD(total)}</p>
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Método de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </div>
              <Button onClick={onCobrar} disabled={registrarVenta.isPending || carrito.length === 0}>
                {registrarVenta.isPending ? 'Cobrando…' : `Cobrar ${carrito.length > 0 ? formatoRD(total) : ''}`}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Button variante="secundario" onClick={() => setModalMovimiento(true)}>
              Registrar entrada/salida de efectivo
            </Button>
            <Button variante="peligro" onClick={() => setModalCerrarTurno(true)}>
              Cerrar turno
            </Button>
          </div>
        </>
      )}

      {data.estado === 'CERRADO' && (
        <div className="space-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
          <div className="grid grid-cols-3 gap-3">
            <p>Esperado: {formatoRD(data.montoEsperado ?? 0)}</p>
            <p>Contado: {formatoRD(data.montoFinalContado ?? 0)}</p>
            <p>Diferencia: {formatoRD(data.diferencia ?? 0)}</p>
          </div>
          {data.justificacionDiferencia && (
            <p className="text-slate-600 dark:text-slate-400">Justificación: {data.justificacionDiferencia}</p>
          )}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <h3 className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Ventas del turno</h3>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {data.facturas.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <span>
                {formatoRD(f.total)} — {f.metodoPago ?? '—'} <Badge tono={f.estado === 'EMITIDA' ? 'exito' : 'neutro'}>{f.estado}</Badge>
              </span>
              <span className="flex items-center gap-3">
                <button type="button" className="text-xs text-sol-600 hover:underline dark:text-sol-400" onClick={() => setFacturaImprimiendo(f.id)}>
                  Imprimir
                </button>
                {f.estado === 'EMITIDA' && tienePermiso('facturacion.anular') && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                    onClick={() => setFacturaAnulando(f)}
                  >
                    Anular/Devolver
                  </button>
                )}
              </span>
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

      {facturaImprimiendo && (
        <ModalImprimir urlBase={`/facturas/${facturaImprimiendo}`} titulo="Imprimir recibo" onClose={() => setFacturaImprimiendo(null)} />
      )}

      {modalMovimiento && <ModalMovimiento turnoId={turnoId} onClose={() => setModalMovimiento(false)} onRegistrado={invalidar} />}

      {modalCerrarTurno && (
        <ModalCerrarTurno
          data={data}
          onClose={() => setModalCerrarTurno(false)}
          onCerrado={() => {
            setModalCerrarTurno(false);
            invalidar();
            onCerrado?.();
          }}
        />
      )}

      {facturaAnulando && (
        <ModalAnularVenta
          factura={facturaAnulando}
          onClose={() => setFacturaAnulando(null)}
          onAnulada={() => {
            setFacturaAnulando(null);
            invalidar();
          }}
        />
      )}

      {ventaConfirmada && (
        <Modal titulo="Venta registrada" onClose={() => setVentaConfirmada(null)}>
          <div className="space-y-4 text-center">
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatoRD(ventaConfirmada.total)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">La venta se registró correctamente.</p>
            <div className="flex justify-center gap-2">
              <Button
                variante="secundario"
                onClick={() => {
                  setFacturaImprimiendo(ventaConfirmada.id);
                  setVentaConfirmada(null);
                }}
              >
                Imprimir recibo
              </Button>
              <Button onClick={() => setVentaConfirmada(null)}>Nueva venta</Button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </Card>
  );
}

function AgregarProducto({ onAgregar }: { onAgregar: (linea: LineaCarrito) => void }) {
  const [producto, setProducto] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState('1');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    if (!producto) return;
    setError(null);
    setCargando(true);
    try {
      const precio = (await apiClient.get<Precio | null>(`/precios/${producto.id}`)).data;
      if (!precio) {
        setError('Este producto no tiene precio configurado.');
        return;
      }
      onAgregar({
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad: Number(cantidad) || 1,
        precioUnitario: Number(precio.precioVenta),
        porcentajeItbis: Number(producto.porcentajeItbis),
      });
      setProducto(null);
      setCantidad('1');
    } catch {
      setError('No se pudo obtener el precio del producto.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[240px] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Producto</label>
        <ComboboxBusqueda<Producto>
          valor={producto}
          onSeleccionar={setProducto}
          obtenerId={(p) => p.id}
          obtenerEtiqueta={(p) => `${p.codigo} — ${p.nombre}`}
          placeholder="Buscar producto…"
          buscar={async (texto) =>
            (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
          }
        />
      </div>
      <Input type="number" min={0.01} step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-24" />
      <Button type="button" variante="secundario" onClick={agregar} disabled={!producto || cargando}>
        {cargando ? 'Agregando…' : 'Agregar'}
      </Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ModalMovimiento({ turnoId, onClose, onRegistrado }: { turnoId: string; onClose: () => void; onRegistrado: () => void }) {
  const [tipoMovimiento, setTipoMovimiento] = useState<'ENTRADA' | 'SALIDA'>('SALIDA');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const registrar = useMutation({
    mutationFn: async () => apiClient.post(`/pos/turnos/${turnoId}/movimientos`, { tipo: tipoMovimiento, monto: Number(monto), concepto }),
    onSuccess: () => {
      onRegistrado();
      onClose();
    },
    onError: () => setError('No se pudo registrar el movimiento.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    registrar.mutate();
  }

  return (
    <Modal titulo="Entrada/salida de efectivo" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <select
            value={tipoMovimiento}
            onChange={(e) => setTipoMovimiento(e.target.value as 'ENTRADA' | 'SALIDA')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="SALIDA">Salida (retiro)</option>
            <option value="ENTRADA">Entrada</option>
          </select>
        </div>
        <FormField id="turno-monto-movimiento" label="Monto" type="number" min={0.01} step="any" value={monto} onChange={(e) => setMonto(e.target.value)} required />
        <FormField id="turno-concepto-movimiento" label="Concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={registrar.isPending} className="w-full">
          {registrar.isPending ? 'Registrando…' : 'Registrar'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalCerrarTurno({
  data,
  onClose,
  onCerrado,
}: {
  data: TurnoCajaDetalleData;
  onClose: () => void;
  onCerrado: () => void;
}) {
  const [montoFinalContado, setMontoFinalContado] = useState('');
  const [justificacionDiferencia, setJustificacionDiferencia] = useState('');
  const [error, setError] = useState<string | null>(null);

  const montoEsperado = calcularMontoEsperado(data);
  const TOLERANCIA_REFERENCIA = 50; // RD$ — default documentado de Configuracion.POS_TOLERANCIA_ARQUEO; el backend valida el real
  const diferencia = montoFinalContado.trim() === '' ? null : Number(montoFinalContado) - montoEsperado;
  const dentroDeTolerancia = diferencia === null || Math.abs(diferencia) <= TOLERANCIA_REFERENCIA;

  const cerrarTurno = useMutation({
    mutationFn: async () =>
      apiClient.post(`/pos/turnos/${data.id}/cerrar`, {
        montoFinalContado: Number(montoFinalContado),
        justificacionDiferencia: justificacionDiferencia || undefined,
      }),
    onSuccess: () => onCerrado(),
    onError: (err: unknown) => {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(mensaje ?? 'No se pudo cerrar el turno.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    cerrarTurno.mutate();
  }

  return (
    <Modal titulo="Cerrar turno" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Efectivo esperado según ventas y movimientos: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatoRD(montoEsperado)}</span>
        </p>
        <FormField
          id="turno-monto-final"
          label="Efectivo contado"
          type="number"
          min={0}
          step="any"
          value={montoFinalContado}
          onChange={(e) => setMontoFinalContado(e.target.value)}
          required
        />
        {diferencia !== null && (
          <p className={dentroDeTolerancia ? 'text-sm text-emerald-600' : 'text-sm font-medium text-amber-600'}>
            Diferencia: {formatoRD(diferencia)}
            {!dentroDeTolerancia && ' — supera la tolerancia habitual, indicá una justificación.'}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="turno-justificacion" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Justificación (si hay descuadre)
          </label>
          <textarea
            id="turno-justificacion"
            value={justificacionDiferencia}
            onChange={(e) => setJustificacionDiferencia(e.target.value)}
            rows={2}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variante="peligro" disabled={cerrarTurno.isPending} className="w-full">
          {cerrarTurno.isPending ? 'Cerrando…' : 'Cerrar turno'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalAnularVenta({ factura, onClose, onAnulada }: { factura: FacturaTurno; onClose: () => void; onAnulada: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anular = useMutation({
    mutationFn: async () => apiClient.post(`/facturas/${factura.id}/anular`, { motivo }),
    onSuccess: () => onAnulada(),
    onError: () => setError('No se pudo anular la venta.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (motivo.trim().length < 3) {
      setError('Indicá un motivo de al menos 3 caracteres.');
      return;
    }
    if (!confirmado) {
      setError('Confirmá que querés anular esta venta antes de continuar.');
      return;
    }
    anular.mutate();
  }

  return (
    <Modal titulo={`Anular/Devolver venta — ${factura.ncf ?? factura.id}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Esta acción es irreversible: la venta quedará anulada y, si corresponde, se reintegrará el inventario. Ya no contará en el efectivo esperado del cierre.
        </p>
        <FormField id="anular-venta-motivo" label="Motivo de la anulación/devolución" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
          Confirmo que quiero anular esta venta.
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variante="peligro" disabled={anular.isPending} className="w-full">
          {anular.isPending ? 'Anulando…' : 'Anular venta'}
        </Button>
      </form>
    </Modal>
  );
}
