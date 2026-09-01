import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, IdCard, ChevronDown, SlidersHorizontal, Printer, Undo2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { CatalogoProductosPos, type ProductoCatalogo } from '../CatalogoProductosPos/CatalogoProductosPos';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { CampoPin } from '../../molecules/CampoPin/CampoPin';
import { CampoCodigoAutorizacion } from '../../molecules/CampoCodigoAutorizacion/CampoCodigoAutorizacion';
import { SelectFormaPago, type FormaPago } from '../../molecules/SelectFormaPago/SelectFormaPago';
import { Select } from '../../atoms/Select/Select';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { FormularioCliente } from '../../molecules/FormularioCliente/FormularioCliente';
import { useAuth } from '../../../hooks/useAuth';
import { useAtajosTeclado } from '../../../hooks/useAtajosTeclado';
import { useListasPrecio } from '../../../hooks/useListasPrecio';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { PaginaResultado } from '../../../types/pagina-resultado';

const ID_COMBOBOX_CLIENTE = 'turno-cliente-combobox';
const ID_COMBOBOX_VENDEDOR = 'turno-vendedor-combobox';

type EstadoTurno = 'ABIERTO' | 'PENDIENTE_REVISION' | 'CERRADO';

const TONO_ESTADO_TURNO: Record<EstadoTurno, 'exito' | 'advertencia' | 'neutro'> = {
  ABIERTO: 'exito',
  PENDIENTE_REVISION: 'advertencia',
  CERRADO: 'neutro',
};

type ComprobantePorDefecto = 'CONTADO' | 'CREDITO' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL';

interface Cliente {
  id: string;
  nombre: string;
  listaPrecio: { id: string; nombre: string } | null;
  comprobantePorDefecto?: ComprobantePorDefecto | null;
  puntosLealtad?: number;
}

interface Vendedor {
  id: string;
  nombre: string;
}

interface LineaCarrito {
  productoId: string;
  varianteId?: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  porcentajeItbis: number;
  /** Monto flat (no %) descontado de esta línea — ver ModalDescuento; misma unidad que LineaFactura.descuento en el backend. */
  descuento: number;
  /** Plan de integración Cuadre, ítem E-8 — habilita el input de precio editable en la fila del carrito. */
  precioVariable?: boolean;
}

/**
 * Identificador único de una línea del carrito — `productoId` SOLO no
 * alcanza: dos variantes del mismo producto (ej. Talla S y Talla M)
 * comparten `productoId` pero son líneas distintas. Usarlo como `key` de
 * React y como criterio de "cuál línea" en quitar/editar/descontar evita
 * que dos variantes del mismo producto colapsen en una sola fila (bug
 * real: agregar la variante S y después la M solo mostraba una).
 */
function claveLinea(l: { productoId: string; varianteId?: string }): string {
  return `${l.productoId}::${l.varianteId ?? ''}`;
}

interface MovimientoCaja {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA';
  monto: string;
  concepto: string;
}

interface VentaAparcadaLinea {
  productoId: string;
  varianteId: string;
  cantidad: string;
  precioUnitario: string;
  porcentajeItbis: string;
  descuento: string;
  producto: { codigo: string; nombre: string };
}

interface VentaAparcada {
  id: string;
  nota: string | null;
  createdAt: string;
  cliente: Cliente | null;
  vendedorEmpleado: Vendedor | null;
  lineas: VentaAparcadaLinea[];
}

/**
 * Borrador silencioso del carrito activo (`CarritoBorrador`, backend) —
 * distinto de VentaAparcada (F12, aparcado explícito del cajero). Se
 * restaura solo al abrir el turno; ver el efecto de restauración más abajo.
 */
interface CarritoBorradorApi {
  cliente: Cliente | null;
  vendedorEmpleado: Vendedor | null;
  listaPrecio: string | null;
  tipoFactura: 'CONTADO' | 'CREDITO' | null;
  tipoComprobanteEspecial: string | null;
  lineas: LineaCarrito[];
}

interface BorradorPayload {
  clienteId?: string;
  vendedorEmpleadoId?: string;
  listaPrecio?: string;
  tipoFactura?: string;
  tipoComprobanteEspecial?: string;
  lineas: LineaCarrito[];
}

interface PagoVentaResumen {
  monto: string;
  formaPago: { id: string; nombre: string; esEfectivo: boolean };
}

interface FacturaTurno {
  id: string;
  ncf: string | null;
  total: string;
  formaPago: { nombre: string; esEfectivo: boolean } | null;
  vendedorEmpleado: { nombre: string } | null;
  pagosVenta: PagoVentaResumen[];
  estado: string;
  tieneNotaAplicada: boolean;
}

interface Cajero {
  id: string;
  nombre: string;
}

/** Respuesta de POST /pos/cotizar — previsualización de solo lectura (Fase 4c, gap Ofertas+POS, ver ARCHITECTURE.md). */
interface CotizacionPos {
  subtotal: number;
  descuento: number;
  itbis: number;
  total: number;
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

function mensajeErrorApi(err: unknown, fallback: string): string {
  const mensaje =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;
  return mensaje ?? fallback;
}

/** Réplica del cálculo de pos.service.ts (calcularMovimientoEfectivo) — solo para mostrar el esperado ANTES de cerrar; el backend sigue siendo la fuente de verdad final. */
function calcularMontoEsperado(data: TurnoCajaDetalleData): number {
  const ventasEfectivo = data.facturas
    .filter((f) => f.estado === 'EMITIDA')
    .flatMap((f) => f.pagosVenta)
    .filter((p) => p.formaPago.esEfectivo)
    .reduce((acc, p) => acc + Number(p.monto), 0);
  const entradas = data.movimientos.filter((m) => m.tipo === 'ENTRADA').reduce((acc, m) => acc + Number(m.monto), 0);
  const salidas = data.movimientos.filter((m) => m.tipo === 'SALIDA').reduce((acc, m) => acc + Number(m.monto), 0);
  return Number(data.montoInicial) + ventasEfectivo + entradas - salidas;
}

/** Desglose por TODAS las formas de pago (plan de integración Cuadre, ítem E-6) — antes el resumen del cierre solo distinguía efectivo. */
function DesglosePorFormaPago({ facturas }: { facturas: FacturaTurno[] }) {
  const porForma = new Map<string, { nombre: string; monto: number }>();
  for (const factura of facturas) {
    if (factura.estado !== 'EMITIDA') continue;
    for (const pago of factura.pagosVenta) {
      const actual = porForma.get(pago.formaPago.id) ?? { nombre: pago.formaPago.nombre, monto: 0 };
      actual.monto += Number(pago.monto);
      porForma.set(pago.formaPago.id, actual);
    }
  }
  const filas = [...porForma.values()].sort((a, b) => b.monto - a.monto);
  if (filas.length === 0) return null;

  return (
    <div>
      <p className="font-medium text-slate-700 dark:text-slate-300">Ventas por forma de pago</p>
      <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
        {filas.map((f) => (
          <li key={f.nombre} className="flex justify-between gap-2 text-slate-600 dark:text-slate-400">
            <span>{f.nombre}</span>
            <span>{formatoRD(f.monto)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** PENDIENTE_REVISION -> CERRADO (ítem E-6). */
function RevisarTurnoBoton({ turnoId, onRevisado }: { turnoId: string; onRevisado: () => void }) {
  const revisar = useMutation({
    mutationFn: async () => apiClient.patch(`/pos/turnos/${turnoId}/revisar`),
    onSuccess: onRevisado,
  });

  return (
    <Button disabled={revisar.isPending} onClick={() => revisar.mutate()}>
      {revisar.isPending ? 'Marcando…' : 'Marcar revisado'}
    </Button>
  );
}

interface TurnoCajaDetalleProps {
  turnoId: string;
  onCerrado?: () => void;
  /** Vive dentro de PosCaja.tsx (pantalla completa, F2-F12) en vez de un Card embebido en AppLayout — omite el wrapper de Card y activa los atajos de teclado. */
  pantallaCompleta?: boolean;
}

export function TurnoCajaDetalle({ turnoId, onCerrado, pantallaCompleta }: TurnoCajaDetalleProps) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [listaPrecioOverride, setListaPrecioOverride] = useState('');
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [tipoComprobanteEspecial, setTipoComprobanteEspecial] = useState('');
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const { data: listasPrecio } = useListasPrecio();
  const listaPrecioResuelta = cliente?.listaPrecio?.nombre ?? 'GENERAL';
  const [modalMovimiento, setModalMovimiento] = useState(false);
  const [modalCerrarTurno, setModalCerrarTurno] = useState(false);
  const [modalDescuento, setModalDescuento] = useState(false);
  const [modalGuardar, setModalGuardar] = useState(false);
  const [modalGuardadas, setModalGuardadas] = useState(false);
  const [modalDevolucion, setModalDevolucion] = useState(false);
  const [modalCheckout, setModalCheckout] = useState(false);
  const [cotizacion, setCotizacion] = useState<CotizacionPos | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [ventaConfirmada, setVentaConfirmada] = useState<{ id: string; total: string } | null>(null);
  const [facturaAnulando, setFacturaAnulando] = useState<FacturaTurno | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facturaImprimiendo, setFacturaImprimiendo] = useState<string | null>(null);
  const [avisoBorrador, setAvisoBorrador] = useState<string | null>(null);
  // Evita aplicar la restauración del borrador más de una vez, y evita un
  // DELETE innecesario cuando el carrito arranca vacío y nunca hubo nada
  // que proteger (ver los dos efectos de borrador más abajo).
  const restoBorradorAplicadoRef = useRef(false);
  const huboBorradorRef = useRef(false);

  // Comprobante fiscal por defecto del cliente (plan de integración Cuadre,
  // ítem E-5) — mismo criterio que ModalNuevaFactura en Facturacion.tsx:
  // autoselecciona al elegir cliente, el cajero lo puede cambiar después.
  useEffect(() => {
    const defecto = cliente?.comprobantePorDefecto;
    if (!defecto) return;
    if (defecto === 'CONTADO' || defecto === 'CREDITO') {
      setTipoFactura(defecto);
      setTipoComprobanteEspecial('');
    } else {
      setTipoComprobanteEspecial(defecto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.id]);

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

  // Borrador silencioso del carrito activo (protege contra un refresh
  // accidental o un apagón antes de "Cobrar"/"Guardar venta" — pedido del
  // usuario). Se pide una sola vez al abrir el turno; `isFetched` (no
  // `data`) es el gate del efecto de restauración de abajo para que corra
  // exactamente una vez, se haya encontrado borrador o no.
  const { data: borradorRemoto, isFetched: borradorFetched } = useQuery({
    queryKey: ['pos-borrador', turnoId],
    queryFn: async () => (await apiClient.get<CarritoBorradorApi | null>(`/pos/turnos/${turnoId}/borrador`)).data,
  });

  useEffect(() => {
    if (!borradorFetched || restoBorradorAplicadoRef.current) return;
    restoBorradorAplicadoRef.current = true;
    if (!borradorRemoto || borradorRemoto.lineas.length === 0) return;
    huboBorradorRef.current = true;
    setCarrito(borradorRemoto.lineas);
    if (borradorRemoto.cliente) setCliente(borradorRemoto.cliente);
    if (borradorRemoto.vendedorEmpleado) setVendedor(borradorRemoto.vendedorEmpleado);
    if (borradorRemoto.listaPrecio) setListaPrecioOverride(borradorRemoto.listaPrecio);
    if (borradorRemoto.tipoFactura) setTipoFactura(borradorRemoto.tipoFactura);
    if (borradorRemoto.tipoComprobanteEspecial) setTipoComprobanteEspecial(borradorRemoto.tipoComprobanteEspecial);
    setAvisoBorrador('Se restauró un carrito sin terminar que había quedado pendiente en este turno.');
  }, [borradorFetched, borradorRemoto]);

  const guardarBorrador = useMutation({
    mutationFn: async (payload: BorradorPayload) => apiClient.put(`/pos/turnos/${turnoId}/borrador`, payload),
  });

  const eliminarBorrador = useMutation({
    mutationFn: async () => apiClient.delete(`/pos/turnos/${turnoId}/borrador`),
  });

  // Snapshot serializado del carrito/cliente/vendedor/etc. — se debounza
  // (800ms) para no pegarle a la base de datos en cada tecla de
  // cantidad/precio; una línea agregada/quitada o un cambio de cliente sí
  // terminan disparando el guardado, solo que con ese pequeño retraso.
  const borradorSnapshot = JSON.stringify({
    clienteId: cliente?.id,
    vendedorEmpleadoId: vendedor?.id,
    listaPrecio: listaPrecioOverride || undefined,
    tipoFactura,
    tipoComprobanteEspecial: tipoComprobanteEspecial || undefined,
    lineas: carrito,
  });
  const borradorSnapshotDebounced = useDebouncedValue(borradorSnapshot, 800);

  useEffect(() => {
    // Frenado hasta saber si había un borrador previo — sin esto, el
    // carrito vacío del primer render podría pisar/borrar un borrador real
    // antes de que el efecto de arriba llegue a restaurarlo.
    if (!borradorFetched) return;
    const payload = JSON.parse(borradorSnapshotDebounced) as BorradorPayload;
    if (payload.lineas.length === 0) {
      if (huboBorradorRef.current) {
        huboBorradorRef.current = false;
        eliminarBorrador.mutate();
      }
      return;
    }
    huboBorradorRef.current = true;
    guardarBorrador.mutate(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borradorSnapshotDebounced, borradorFetched]);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['pos-turno', turnoId] });
    queryClient.invalidateQueries({ queryKey: ['pos-turnos'] });
  }

  const registrarVenta = useMutation({
    mutationFn: async (pagos: { formaPagoId: string; monto: number; referencia?: string }[]) =>
      apiClient.post('/pos/ventas', {
        turnoCajaId: turnoId,
        clienteId: cliente?.id,
        vendedorEmpleadoId: vendedor?.id,
        listaPrecio: listaPrecioOverride || undefined,
        tipoFactura,
        tipoComprobanteEspecial: tipoComprobanteEspecial || undefined,
        pagos,
        // `descuento` solo se manda si el cajero realmente lo tocó con F8
        // (Descuento) — mandar siempre 0 por defecto bloqueaba las ofertas
        // automáticas (Fase 4b): el backend trata CUALQUIER descuento
        // explícito, incluido 0, como "el caller ya decidió, no resuelvas
        // nada automático" (bug real, encontrado en la verificación manual
        // de esta fase — el 10% de una oferta activa nunca se aplicaba en
        // el POS, solo en Facturación manual).
        lineas: carrito.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          cantidad: l.cantidad,
          ...(l.descuento > 0 ? { descuento: l.descuento } : {}),
        })),
      }),
    onSuccess: (respuesta) => {
      invalidar();
      setCarrito([]);
      setVendedor(null);
      setListaPrecioOverride('');
      setTipoFactura('CONTADO');
      setTipoComprobanteEspecial('');
      setError(null);
      setModalCheckout(false);
      setCotizacion(null);
      setVentaConfirmada({ id: respuesta.data.id, total: respuesta.data.total });
      // Venta confirmada — el borrador ya no protege nada, se borra ya
      // mismo (no hace falta esperar el debounce del efecto de guardado).
      huboBorradorRef.current = false;
      eliminarBorrador.mutate();
      setAvisoBorrador(null);
    },
    // El error de esta mutación se muestra DENTRO de ModalCheckout (ver
    // registrarVentaError más abajo), no acá — mientras el cajero está
    // parado en el modal de "Cobrar" con la venta fallando (ej. stock
    // insuficiente, bono inválido/vencido/sin saldo), el mensaje tiene
    // que aparecer ahí mismo, no arriba de toda la pantalla detrás del
    // overlay oscuro (bug real, reportado por el usuario). `error`
    // (arriba de la página) queda solo para validaciones ANTES de abrir
    // el modal (carrito vacío, sin cliente, falla al cotizar).
  });
  const registrarVentaError = registrarVenta.error ? mensajeErrorApi(registrarVenta.error, 'No se pudo registrar la venta — revisá el stock disponible.') : null;

  const { data: guardadas } = useQuery({
    queryKey: ['pos-guardadas', turnoId],
    queryFn: async () => (await apiClient.get<VentaAparcada[]>(`/pos/turnos/${turnoId}/guardadas`)).data,
    enabled: modalGuardadas,
  });

  const guardarVenta = useMutation({
    mutationFn: async (nota: string) =>
      apiClient.post(`/pos/turnos/${turnoId}/guardar`, {
        clienteId: cliente?.id,
        vendedorEmpleadoId: vendedor?.id,
        nota: nota || undefined,
        lineas: carrito.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          porcentajeItbis: l.porcentajeItbis,
          descuento: l.descuento,
        })),
      }),
    onSuccess: () => {
      setCarrito([]);
      setVendedor(null);
      setModalGuardar(false);
      // Ya quedó a salvo como VentaAparcada (Guardadas, ⇧F12) — el
      // borrador silencioso ya no hace falta.
      huboBorradorRef.current = false;
      eliminarBorrador.mutate();
      setAvisoBorrador(null);
    },
  });

  const eliminarGuardada = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/pos/ventas-aparcadas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pos-guardadas', turnoId] }),
  });

  function agregarAlCarrito(linea: LineaCarrito) {
    setCarrito((prev) => {
      const mismaLinea = (l: LineaCarrito) => l.productoId === linea.productoId && l.varianteId === linea.varianteId;
      const existente = prev.find(mismaLinea);
      if (existente) {
        return prev.map((l) => (mismaLinea(l) ? { ...l, cantidad: l.cantidad + linea.cantidad } : l));
      }
      return [...prev, linea];
    });
  }

  function agregarProductoCatalogo(producto: ProductoCatalogo, cantidad: number, varianteId?: string) {
    if (!producto.precioVenta) return;
    agregarAlCarrito({
      productoId: producto.id,
      varianteId,
      codigo: producto.codigo,
      nombre: producto.nombre,
      cantidad,
      precioUnitario: Number(producto.precioVenta),
      porcentajeItbis: Number(producto.porcentajeItbis),
      descuento: 0,
      precioVariable: producto.precioVariable,
    });
  }

  function quitarDelCarrito(productoId: string, varianteId?: string) {
    const clave = claveLinea({ productoId, varianteId });
    setCarrito((prev) => prev.filter((l) => claveLinea(l) !== clave));
  }

  function cambiarPrecio(productoId: string, varianteId: string | undefined, precioUnitario: number) {
    const clave = claveLinea({ productoId, varianteId });
    setCarrito((prev) => prev.map((l) => (claveLinea(l) === clave ? { ...l, precioUnitario } : l)));
  }

  function cambiarCantidad(productoId: string, varianteId: string | undefined, cantidad: number) {
    const clave = claveLinea({ productoId, varianteId });
    setCarrito((prev) => prev.map((l) => (claveLinea(l) === clave ? { ...l, cantidad } : l)));
  }

  /** Recupera una venta aparcada (Guardadas, ⇧F12): repone el carrito/cliente/vendedor y la borra de la lista. */
  function cargarVentaAparcada(venta: VentaAparcada) {
    setCarrito(
      venta.lineas.map((l) => ({
        productoId: l.productoId,
        varianteId: l.varianteId,
        codigo: l.producto.codigo,
        nombre: l.producto.nombre,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        porcentajeItbis: Number(l.porcentajeItbis),
        descuento: Number(l.descuento),
      })),
    );
    setCliente(venta.cliente);
    setVendedor(venta.vendedorEmpleado);
    eliminarGuardada.mutate(venta.id);
    setModalGuardadas(false);
    setAvisoBorrador(null);
  }

  /** Aplica un descuento (monto flat o %) a las líneas seleccionadas (claveLinea) — ver ModalDescuento. */
  function aplicarDescuento(claves: string[], montoOPct: number, modo: 'MONTO' | 'PORCENTAJE') {
    setCarrito((prev) =>
      prev.map((l) => {
        if (!claves.includes(claveLinea(l))) return l;
        const descuento = modo === 'PORCENTAJE' ? (l.cantidad * l.precioUnitario * montoOPct) / 100 : montoOPct;
        return { ...l, descuento };
      }),
    );
  }

  // Subtotal bruto (antes de descuento) para el recibo; el ITBIS y el total sí
  // se calculan sobre el neto, igual que FacturacionService.crear() en el backend.
  const subtotalBruto = carrito.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0);
  const totalDescuentos = carrito.reduce((acc, l) => acc + l.descuento, 0);
  const itbis = carrito.reduce((acc, l) => acc + (l.cantidad * l.precioUnitario - l.descuento) * (l.porcentajeItbis / 100), 0);
  const total = subtotalBruto - totalDescuentos + itbis;

  /**
   * Antes abría el checkout directo con el total estimado en el navegador —
   * si había una Oferta vigente (Fase 4b), ese estimado no incluía el
   * descuento real y la venta terminaba fallando al confirmar ("La suma de
   * los pagos no coincide con el total"). Ahora cotiza contra el backend
   * primero (POST /pos/cotizar, sin efectos secundarios) y el checkout se
   * arma sobre ESE total — ver ARCHITECTURE.md, "Ofertas — limitación
   * conocida" (Fase 4c).
   */
  async function onAbrirCheckout() {
    setError(null);
    if (carrito.length === 0) {
      setError('Agregá al menos un producto al carrito.');
      return;
    }
    if (!cliente) {
      setError('Seleccioná un cliente (o dejá el Consumidor Final por defecto).');
      return;
    }
    setCotizando(true);
    try {
      const { data: resultado } = await apiClient.post<CotizacionPos>('/pos/cotizar', {
        clienteId: cliente.id,
        listaPrecio: listaPrecioOverride || undefined,
        lineas: carrito.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          cantidad: l.cantidad,
          ...(l.descuento > 0 ? { descuento: l.descuento } : {}),
        })),
      });
      // Sin esto, el error de un intento de cobro anterior (ej. "Stock
      // insuficiente") quedaba pegado en pantalla aunque el cajero ya
      // hubiera sacado el producto problemático del carrito y volviera a
      // abrir "Cobrar" — `registrarVenta.error` (react-query) no se limpia
      // solo, sigue ahí hasta el próximo `.mutate()` (bug real, reportado
      // por el usuario).
      registrarVenta.reset();
      setCotizacion(resultado);
      setModalCheckout(true);
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo calcular el total de la venta.'));
    } finally {
      setCotizando(false);
    }
  }

  /** Mismo motivo que el `registrarVenta.reset()` de arriba — sin esto, un error de un intento anterior de "Guardar venta" quedaría pegado la próxima vez que se abre el modal. */
  function abrirModalGuardar() {
    guardarVenta.reset();
    setModalGuardar(true);
  }

  const puedeVender = !!data && data.estado === 'ABIERTO';

  useAtajosTeclado(
    {
      F2: () => document.getElementById(ID_COMBOBOX_VENDEDOR)?.focus(),
      F3: () => document.getElementById(ID_COMBOBOX_CLIENTE)?.focus(),
      F4: () => setModalDevolucion(true),
      F5: () => invalidar(),
      F6: () => {
        setCarrito([]);
        setAvisoBorrador(null);
      },
      F7: () => setModalMovimiento(true),
      F8: () => carrito.length > 0 && setModalDescuento(true),
      F9: () => setModalCerrarTurno(true),
      F10: () => onAbrirCheckout(),
      F12: () => carrito.length > 0 && abrirModalGuardar(),
      'Shift+F12': () => setModalGuardadas(true),
    },
    pantallaCompleta && puedeVender,
  );

  if (isLoading || !data) return <p className="text-sm text-slate-500">Cargando turno…</p>;

  const descripcion =
    `Abierto por ${data.cajero.nombre}` +
    (data.estado === 'CERRADO' && data.cerradoPor && data.cerradoPor.id !== data.cajero.id ? ` — cerrado por ${data.cerradoPor.nombre}` : '');

  return (
    <Card
      titulo={pantallaCompleta ? undefined : 'Turno de caja'}
      descripcion={pantallaCompleta ? undefined : descripcion}
      acciones={pantallaCompleta ? undefined : <Badge tono={TONO_ESTADO_TURNO[data.estado]}>{data.estado}</Badge>}
      className={pantallaCompleta ? 'border-0 bg-transparent shadow-none dark:bg-transparent' : undefined}
      sinPadding={pantallaCompleta}
    >
      <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {avisoBorrador && (
        <p className="flex items-center justify-between gap-2 rounded-md bg-sol-50 px-3 py-2 text-sm text-sol-700 dark:bg-sol-900/30 dark:text-sol-300">
          {avisoBorrador}
          <button type="button" onClick={() => setAvisoBorrador(null)} className="shrink-0 text-xs underline">
            Descartar
          </button>
        </p>
      )}

      {data.estado === 'ABIERTO' && tienePermiso('pos.editar') && (
        <>
          <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-3 dark:border-slate-800 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <CatalogoProductosPos onAgregar={agregarProductoCatalogo} bodegaId={data.bodegaId} />
            </div>

            <div className="space-y-3 lg:col-span-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</label>
                  <ComboboxBusqueda<Cliente>
                    id={ID_COMBOBOX_CLIENTE}
                    valor={cliente}
                    onSeleccionar={setCliente}
                    obtenerId={(c) => c.id}
                    obtenerEtiqueta={(c) => c.nombre}
                    placeholder="Buscar cliente…"
                    icono={<User size={15} />}
                    buscar={async (texto) =>
                      (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarNuevoCliente((v) => !v)}
                    className="self-start text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
                  >
                    + Nuevo cliente
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Vendedor</label>
                  <ComboboxBusqueda<Vendedor>
                    id={ID_COMBOBOX_VENDEDOR}
                    valor={vendedor}
                    onSeleccionar={setVendedor}
                    obtenerId={(v) => v.id}
                    obtenerEtiqueta={(v) => v.nombre}
                    placeholder="Buscar vendedor…"
                    icono={<IdCard size={15} />}
                    buscar={async (texto) => (await apiClient.get<Vendedor[]>('/pos/vendedores', { params: { busqueda: texto } })).data}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500">Opcional, para comisión</p>
                </div>
              </div>

              {mostrarNuevoCliente && (
                <Modal titulo="Nuevo cliente" onClose={() => setMostrarNuevoCliente(false)}>
                  <FormularioCliente
                    cliente={null}
                    onGuardado={(c) => {
                      setCliente(c);
                      setMostrarNuevoCliente(false);
                    }}
                  />
                </Modal>
              )}

              <details className="group rounded-lg border border-slate-200 dark:border-slate-800">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 marker:content-none hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60 [&::-webkit-details-marker]:hidden">
                  <SlidersHorizontal size={13} />
                  Nivel de precio · Tipo · Comprobante
                  <ChevronDown size={13} className="ml-auto transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-2 border-t border-slate-100 p-2 dark:border-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Nivel de precio</label>
                    <Select value={listaPrecioOverride} onChange={(e) => setListaPrecioOverride(e.target.value)}>
                      <option value="">Usar el del cliente ({listaPrecioResuelta})</option>
                      {listasPrecio?.map((lista) => (
                        <option key={lista.id} value={lista.nombre}>
                          {lista.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tipo</label>
                      <Select value={tipoFactura} onChange={(e) => setTipoFactura(e.target.value as 'CONTADO' | 'CREDITO')}>
                        <option value="CONTADO">Contado</option>
                        <option value="CREDITO">Crédito</option>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Comprobante</label>
                      <Select value={tipoComprobanteEspecial} onChange={(e) => setTipoComprobanteEspecial(e.target.value)}>
                        <option value="">Normal</option>
                        <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
                        <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
                      </Select>
                    </div>
                  </div>
                </div>
              </details>

              <Card sinPadding>
                {carrito.length > 0 && (
                  <div className="flex justify-end border-b border-slate-100 px-3 py-1.5 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalDescuento(true)}
                      className="text-xs font-medium text-sol-600 hover:underline dark:text-sol-400"
                    >
                      Descuento (F8)
                    </button>
                  </div>
                )}
                <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {carrito.map((l) => (
                    <li key={claveLinea(l)} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">{l.nombre}</p>
                        {l.precioVariable ? (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>RD$</span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={l.precioUnitario}
                              onChange={(e) => cambiarPrecio(l.productoId, l.varianteId, Number(e.target.value))}
                              className="w-20 rounded-md border border-slate-300 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                            <span>c/u</span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">{formatoRD(l.precioUnitario)} c/u</p>
                        )}
                        {l.descuento > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">desc. {formatoRD(l.descuento)}</p>
                        )}
                      </div>
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        value={l.cantidad}
                        onChange={(e) => cambiarCantidad(l.productoId, l.varianteId, Number(e.target.value))}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <span className="w-20 shrink-0 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatoRD(l.cantidad * l.precioUnitario - l.descuento)}
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarDelCarrito(l.productoId, l.varianteId)}
                        className="text-red-600 hover:text-red-700"
                        aria-label="Quitar del carrito"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {carrito.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Carrito vacío — elegí un producto del catálogo.</li>}
                </ul>

                {carrito.length > 0 && (
                  <div className="space-y-0.5 border-t border-slate-100 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatoRD(subtotalBruto)}</span>
                    </div>
                    {totalDescuentos > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span>Descuento</span>
                        <span>− {formatoRD(totalDescuentos)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ITBIS</span>
                      <span>{formatoRD(itbis)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-slate-900 dark:text-slate-100">
                      <span>Total</span>
                      <span>{formatoRD(total)}</span>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                  <Button onClick={onAbrirCheckout} disabled={carrito.length === 0 || cotizando} className="w-full">
                    {cotizando ? 'Calculando…' : `Cobrar (F10) ${carrito.length > 0 ? formatoRD(total) : ''}`}
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Button variante="secundario" onClick={() => setModalMovimiento(true)}>
              Registrar entrada/salida de efectivo
            </Button>
            {tienePermiso('facturacion.anular') && (
              <Button variante="secundario" onClick={() => setModalDevolucion(true)}>
                Devolución (F4)
              </Button>
            )}
            <Button variante="secundario" onClick={abrirModalGuardar} disabled={carrito.length === 0}>
              Guardar venta (F12)
            </Button>
            <Button variante="secundario" onClick={() => setModalGuardadas(true)}>
              Guardadas (⇧F12)
            </Button>
            <Button variante="peligro" onClick={() => setModalCerrarTurno(true)}>
              Cerrar turno
            </Button>
          </div>
        </>
      )}

      {(data.estado === 'CERRADO' || data.estado === 'PENDIENTE_REVISION') && (
        <div className="space-y-2 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
          <div className="grid grid-cols-3 gap-3">
            <p>Esperado: {formatoRD(data.montoEsperado ?? 0)}</p>
            <p>Contado: {formatoRD(data.montoFinalContado ?? 0)}</p>
            <p>Diferencia: {formatoRD(data.diferencia ?? 0)}</p>
          </div>
          {data.justificacionDiferencia && (
            <p className="text-slate-600 dark:text-slate-400">Justificación: {data.justificacionDiferencia}</p>
          )}
          <DesglosePorFormaPago facturas={data.facturas} />
          {data.estado === 'PENDIENTE_REVISION' && tienePermiso('pos.supervisar') && (
            <RevisarTurnoBoton
              turnoId={turnoId}
              onRevisado={() => {
                queryClient.invalidateQueries({ queryKey: ['pos-turno', turnoId] });
                queryClient.invalidateQueries({ queryKey: ['pos-turnos'] });
              }}
            />
          )}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <h3 className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Ventas del turno</h3>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {data.facturas.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <span>
                {formatoRD(f.total)} — {f.formaPago?.nombre ?? '—'}
                {f.pagosVenta.length > 1 && ` (+${f.pagosVenta.length - 1} forma${f.pagosVenta.length > 2 ? 's' : ''} más)`}
                {f.vendedorEmpleado && ` — vendedor: ${f.vendedorEmpleado.nombre}`}{' '}
                <Badge tono={f.estado === 'EMITIDA' ? 'exito' : 'neutro'}>{f.estado}</Badge>
                {f.tieneNotaAplicada && (
                  <>
                    {' '}
                    <Badge tono="advertencia">Devuelta</Badge>
                  </>
                )}
              </span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-sol-600 hover:underline dark:text-sol-400"
                  onClick={() => setFacturaImprimiendo(f.id)}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  Imprimir
                </button>
                {f.estado === 'EMITIDA' &&
                  tienePermiso('facturacion.anular') &&
                  (data.estado === 'ABIERTO' || tienePermiso('pos.supervisar')) && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                    onClick={() => setFacturaAnulando(f)}
                  >
                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
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

      {modalDescuento && (
        <ModalDescuento carrito={carrito} onAplicar={aplicarDescuento} onClose={() => setModalDescuento(false)} />
      )}

      {modalCheckout && cotizacion && (
        <ModalCheckout
          cotizacion={cotizacion}
          cliente={cliente}
          registrando={registrarVenta.isPending}
          error={registrarVentaError}
          onConfirmar={(pagos) => registrarVenta.mutate(pagos)}
          onClose={() => {
            setModalCheckout(false);
            setCotizacion(null);
          }}
        />
      )}

      {modalGuardar && (
        <ModalGuardar
          onGuardar={(nota) => guardarVenta.mutate(nota)}
          guardando={guardarVenta.isPending}
          error={guardarVenta.error ? mensajeErrorApi(guardarVenta.error, 'No se pudo guardar la venta.') : null}
          onClose={() => setModalGuardar(false)}
        />
      )}

      {modalGuardadas && (
        <ModalGuardadas
          guardadas={guardadas ?? []}
          onRecuperar={cargarVentaAparcada}
          onClose={() => setModalGuardadas(false)}
        />
      )}

      {modalDevolucion && (
        <ModalDevolucion
          turnoCajaId={turnoId}
          onDevuelta={() => {
            invalidar();
            setModalDevolucion(false);
          }}
          onClose={() => setModalDevolucion(false)}
        />
      )}

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

function ModalDescuento({
  carrito,
  onAplicar,
  onClose,
}: {
  carrito: LineaCarrito[];
  onAplicar: (claves: string[], montoOPct: number, modo: 'MONTO' | 'PORCENTAJE') => void;
  onClose: () => void;
}) {
  const [modo, setModo] = useState<'PORCENTAJE' | 'MONTO'>('PORCENTAJE');
  const [valor, setValor] = useState('');
  const [seleccionadas, setSeleccionadas] = useState<string[]>(carrito.map(claveLinea));

  function alternar(clave: string) {
    setSeleccionadas((prev) => (prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (seleccionadas.length === 0 || !valor) return;
    onAplicar(seleccionadas, Number(valor), modo);
    onClose();
  }

  return (
    <Modal titulo="Descuento" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" variante={modo === 'PORCENTAJE' ? 'primario' : 'secundario'} onClick={() => setModo('PORCENTAJE')} className="flex-1">
            %
          </Button>
          <Button type="button" variante={modo === 'MONTO' ? 'primario' : 'secundario'} onClick={() => setModo('MONTO')} className="flex-1">
            Monto fijo
          </Button>
        </div>
        <FormField
          id="descuento-valor"
          label={modo === 'PORCENTAJE' ? 'Porcentaje de descuento' : 'Monto de descuento (por línea)'}
          type="number"
          min={0}
          step="any"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Aplicar a</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
            {carrito.map((l) => (
              <li key={claveLinea(l)}>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={seleccionadas.includes(claveLinea(l))} onChange={() => alternar(claveLinea(l))} />
                  {l.nombre}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <Button type="submit" disabled={seleccionadas.length === 0 || !valor} className="w-full">
          Aplicar descuento
        </Button>
      </form>
    </Modal>
  );
}

function ModalGuardar({
  onGuardar,
  guardando,
  error,
  onClose,
}: {
  onGuardar: (nota: string) => void;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [nota, setNota] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(nota);
  }

  return (
    <Modal titulo="Guardar venta" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          El carrito actual se aparca — podés recuperarlo después desde "Guardadas" (⇧F12) sin perder líneas, cliente ni vendedor.
        </p>
        <FormField id="guardar-venta-nota" label="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardando} className="w-full">
          {guardando ? 'Guardando…' : 'Guardar venta'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalGuardadas({
  guardadas,
  onRecuperar,
  onClose,
}: {
  guardadas: VentaAparcada[];
  onRecuperar: (venta: VentaAparcada) => void;
  onClose: () => void;
}) {
  return (
    <Modal titulo="Ventas guardadas" onClose={onClose}>
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {guardadas.map((v) => (
          <li key={v.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {v.cliente?.nombre ?? 'Sin cliente'}
                  {v.vendedorEmpleado && ` — vendedor: ${v.vendedorEmpleado.nombre}`}
                </p>
                <p className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString('es-DO')}</p>
                {v.nota && <p className="text-xs text-slate-500 dark:text-slate-400">"{v.nota}"</p>}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {v.lineas.length} línea{v.lineas.length === 1 ? '' : 's'} — {v.lineas.map((l) => l.producto.nombre).join(', ')}
                </p>
              </div>
              <Button onClick={() => onRecuperar(v)}>Recuperar</Button>
            </div>
          </li>
        ))}
        {guardadas.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No hay ventas guardadas en este turno.</li>}
      </ul>
    </Modal>
  );
}

interface LineaFacturaDevolucion {
  productoId: string;
  nombre: string;
  codigo: string;
  cantidadOriginal: number;
  disponible: number;
}

interface FacturaParaDevolucion {
  id: string;
  ncf: string | null;
  lineas: LineaFacturaDevolucion[];
}

interface FacturaParaDevolver {
  id: string;
  numero: string | null;
  ncf: string | null;
  total: string;
  cliente: { nombre: string };
  tieneNotaAplicada: boolean;
}

/**
 * Devolución parcial (F4) — reusa Nota de Crédito en el backend, ver
 * ARCHITECTURE.md. Buscador de "venta a devolver" en vez de un select
 * limitado a las ventas del turno actual (ítem "buscador de
 * Devolución") — mismo patrón que EmitirNotaForm.tsx.
 */
function ModalDevolucion({
  turnoCajaId,
  onDevuelta,
  onClose,
}: {
  turnoCajaId: string;
  onDevuelta: () => void;
  onClose: () => void;
}) {
  const { usuario } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [facturaId, setFacturaId] = useState('');
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaParaDevolver | null>(null);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [formaPagoId, setFormaPagoId] = useState('');
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: resultados, isFetching: buscando } = useQuery({
    queryKey: ['pos-facturas-para-devolver', busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<FacturaParaDevolver>>('/pos/facturas-para-devolver', {
          params: { busqueda: busquedaDebounced || undefined },
        })
      ).data,
    enabled: !facturaId,
  });

  const { data: factura, isLoading } = useQuery({
    queryKey: ['pos-factura-devolucion', facturaId],
    queryFn: async () => (await apiClient.get<FacturaParaDevolucion>(`/pos/facturas/${facturaId}/devolucion`)).data,
    enabled: !!facturaId,
  });

  const devolver = useMutation({
    mutationFn: async () => {
      const lineas = Object.entries(cantidades)
        .map(([productoId, cantidad]) => ({ productoId, cantidad: Number(cantidad) }))
        .filter((l) => l.cantidad > 0);
      return apiClient.post('/pos/devoluciones', {
        facturaOrigenId: facturaId,
        turnoCajaId,
        formaPagoId,
        lineas,
        codigoAutorizacion: codigoAutorizacion || undefined,
      });
    },
    onSuccess: onDevuelta,
    onError: (err: unknown) => setError(mensajeErrorApi(err, 'No se pudo registrar la devolución — revisá las cantidades.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const hayCantidad = Object.values(cantidades).some((c) => Number(c) > 0);
    if (!hayCantidad) {
      setError('Indicá al menos una cantidad a devolver.');
      return;
    }
    if (!formaPagoId) {
      setError('Seleccioná la forma de pago del reintegro.');
      return;
    }
    devolver.mutate();
  }

  function elegirFactura(f: FacturaParaDevolver) {
    setFacturaSeleccionada(f);
    setFacturaId(f.id);
    setCantidades({});
  }

  function volverABuscar() {
    setFacturaId('');
    setFacturaSeleccionada(null);
    setCantidades({});
    setError(null);
  }

  return (
    <Modal titulo="Devolución" onClose={onClose}>
      <div className="space-y-3">
        {!facturaId && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Venta a devolver</label>
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por número, NCF o cliente…" />
            <div className="mt-1 max-h-64 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {buscando && <p className="px-3 py-4 text-center text-sm text-slate-500">Buscando…</p>}
              {!buscando && resultados?.datos.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-slate-500">No se encontraron ventas.</p>
              )}
              {resultados?.datos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => elegirFactura(f)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 dark:text-slate-100">
                      {f.numero ?? f.id.slice(0, 8)} {f.ncf ? <span className="text-slate-400">· {f.ncf}</span> : null}
                    </span>
                    <span className="block truncate text-slate-500 dark:text-slate-400">{f.cliente.nombre}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{formatoRD(f.total)}</span>
                    {f.tieneNotaAplicada && <Badge tono="advertencia">Nota aplicada</Badge>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {facturaId && facturaSeleccionada && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/40">
            <span className="text-slate-700 dark:text-slate-300">
              {facturaSeleccionada.numero ?? facturaSeleccionada.id.slice(0, 8)}
              {facturaSeleccionada.ncf ? ` · ${facturaSeleccionada.ncf}` : ''} — {facturaSeleccionada.cliente.nombre}
            </span>
            <Button type="button" variante="secundario" onClick={volverABuscar}>
              Cambiar
            </Button>
          </div>
        )}

        {isLoading && <p className="text-sm text-slate-500">Cargando líneas…</p>}

        {factura && (
          <form onSubmit={onSubmit} className="space-y-3">
            <ul className="space-y-2">
              {factura.lineas.map((l) => (
                <li key={l.productoId} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">{l.nombre}</span>
                  <span className="shrink-0 text-xs text-slate-400">disponible: {l.disponible}</span>
                  <input
                    type="number"
                    min={0}
                    max={l.disponible}
                    step="any"
                    disabled={l.disponible <= 0}
                    value={cantidades[l.productoId] ?? ''}
                    onChange={(e) => setCantidades((prev) => ({ ...prev, [l.productoId]: e.target.value }))}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Forma de pago del reintegro</label>
              <SelectFormaPago value={formaPagoId} onChange={setFormaPagoId} />
            </div>
            <CampoCodigoAutorizacion
              requerido={usuario?.requiereAutorizacionDevolucion}
              solicitarUrl="/pos/devoluciones/solicitar-autorizacion"
              solicitarBody={{ facturaOrigenId: facturaId, turnoCajaId }}
              value={codigoAutorizacion}
              onChange={setCodigoAutorizacion}
              id="devolucion-codigo-autorizacion"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" variante="peligro" disabled={devolver.isPending} className="w-full">
              {devolver.isPending ? 'Procesando…' : 'Confirmar devolución'}
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}

const MONTOS_RAPIDOS = [100, 200, 500, 1000];
const EPSILON_PAGOS = 0.005;

interface PagoAgregado {
  formaPagoId: string;
  nombreFormaPago: string;
  monto: number;
  referencia?: string;
}

/**
 * Checkout (F10) — reemplaza el flujo de una sola forma de pago. Soporta
 * pago dividido: se van agregando pagos (cada uno con su forma) hasta
 * cubrir el total; el sobrante (si el cajero registra de más, ej. "pagó
 * con 1000" en una venta de 700) se muestra como cambio pero NUNCA se
 * envía al backend — al confirmar, `pagosParaEnviar` recorta el último
 * pago para que la suma enviada sea exacta al total (ver ARCHITECTURE.md).
 */
function ModalCheckout({
  cotizacion,
  cliente,
  registrando,
  error,
  onConfirmar,
  onClose,
}: {
  cotizacion: { subtotal: number; descuento: number; itbis: number; total: number };
  cliente: Cliente | null;
  registrando: boolean;
  /** Error de la mutación de registrar la venta (ej. "Stock insuficiente") — se muestra DENTRO de este modal, no en la página de atrás. */
  error: string | null;
  onConfirmar: (pagos: { formaPagoId: string; monto: number; referencia?: string }[]) => void;
  onClose: () => void;
}) {
  const { total } = cotizacion;
  const [pagos, setPagos] = useState<PagoAgregado[]>([]);
  const [formaSeleccionada, setFormaSeleccionada] = useState<FormaPago | undefined>(undefined);
  const [formaPagoId, setFormaPagoId] = useState('');
  const [monto, setMonto] = useState('');
  const [referencia, setReferencia] = useState('');

  const sumaPagos = pagos.reduce((acc, p) => acc + p.monto, 0);
  const pendiente = Math.max(0, total - sumaPagos);
  const cambio = Math.max(0, sumaPagos - total);
  const puedeConfirmar = pagos.length > 0 && sumaPagos + EPSILON_PAGOS >= total;

  function agregarPago() {
    if (!formaPagoId || !monto || Number(monto) <= 0) return;
    setPagos((prev) => [
      ...prev,
      { formaPagoId, nombreFormaPago: formaSeleccionada?.nombre ?? '', monto: Number(monto), referencia: referencia || undefined },
    ]);
    setMonto('');
    setReferencia('');
  }

  function quitarPago(indice: number) {
    setPagos((prev) => prev.filter((_, i) => i !== indice));
  }

  function confirmar() {
    // Recorta el sobrante (cambio) para que la suma enviada al backend sea
    // exacta al total — el backend valida esto con la misma tolerancia.
    let acumulado = 0;
    const pagosParaEnviar: { formaPagoId: string; monto: number; referencia?: string }[] = [];
    for (const p of pagos) {
      const restante = total - acumulado;
      if (restante <= EPSILON_PAGOS) break;
      const montoAplicado = Math.min(p.monto, restante);
      pagosParaEnviar.push({ formaPagoId: p.formaPagoId, monto: montoAplicado, referencia: p.referencia });
      acumulado += montoAplicado;
    }
    onConfirmar(pagosParaEnviar);
  }

  return (
    <Modal titulo="Cobrar" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-0.5 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatoRD(cotizacion.subtotal + cotizacion.descuento)}</span>
          </div>
          {cotizacion.descuento > 0 && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>Descuento (incluye ofertas vigentes)</span>
              <span>− {formatoRD(cotizacion.descuento)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>ITBIS</span>
            <span>{formatoRD(cotizacion.itbis)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total a cobrar</span>
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatoRD(total)}</span>
          </div>
        </div>

        {pagos.length > 0 && (
          <ul className="space-y-1 rounded-md border border-slate-200 p-2 text-sm dark:border-slate-800">
            {pagos.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-slate-700 dark:text-slate-300">
                  {p.nombreFormaPago} {p.referencia && `(${p.referencia})`}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{formatoRD(p.monto)}</span>
                  <button type="button" onClick={() => quitarPago(i)} className="text-red-600 hover:text-red-700" aria-label="Quitar pago">
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Pendiente</span>
          <span className={pendiente > 0 ? 'font-medium text-amber-600' : 'font-medium text-emerald-600'}>{formatoRD(pendiente)}</span>
        </div>
        {cambio > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Cambio</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">{formatoRD(cambio)}</span>
          </div>
        )}

        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <SelectFormaPago
            value={formaPagoId}
            onChange={(id, forma) => {
              setFormaPagoId(id);
              setFormaSeleccionada(forma);
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMonto(pendiente > 0 ? pendiente.toFixed(2) : '')}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-sol-300 dark:border-slate-700 dark:text-slate-300"
            >
              Exacto
            </button>
            {MONTOS_RAPIDOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonto(String(m))}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-sol-300 dark:border-slate-700 dark:text-slate-300"
              >
                {formatoRD(m)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={0.01}
              step="any"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Monto"
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {formaSeleccionada?.esPuntosLealtad && (
              <p className="w-full text-xs text-slate-500 dark:text-slate-400">
                Saldo de puntos del cliente: <span className="font-medium">{cliente?.puntosLealtad ?? 0}</span>
              </p>
            )}
            {formaSeleccionada?.requiereReferencia && (
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder={formaSeleccionada?.esBono ? 'Código del bono (BONO-XXXXXXXX)' : 'Referencia'}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
            <Button type="button" variante="secundario" onClick={agregarPago} disabled={!formaPagoId || !monto}>
              Agregar pago
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={confirmar} disabled={!puedeConfirmar || registrando} className="w-full">
          {registrando ? 'Cobrando…' : 'Confirmar venta'}
        </Button>
      </div>
    </Modal>
  );
}

function ModalMovimiento({ turnoId, onClose, onRegistrado }: { turnoId: string; onClose: () => void; onRegistrado: () => void }) {
  const [tipoMovimiento, setTipoMovimiento] = useState<'ENTRADA' | 'SALIDA'>('SALIDA');
  const [monto, setMonto] = useState('');
  const [motivoTipo, setMotivoTipo] = useState('');
  const [concepto, setConcepto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const registrar = useMutation({
    mutationFn: async () =>
      apiClient.post(`/pos/turnos/${turnoId}/movimientos`, {
        tipo: tipoMovimiento,
        monto: Number(monto),
        motivoTipo,
        concepto: concepto || undefined,
      }),
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
        <div className="flex flex-col gap-1">
          <label htmlFor="turno-motivo-movimiento" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Motivo
          </label>
          <select
            id="turno-motivo-movimiento"
            value={motivoTipo}
            onChange={(e) => setMotivoTipo(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="" disabled>
              Seleccioná un motivo…
            </option>
            <option value="FONDO_CAMBIO">Fondo de cambio</option>
            <option value="DEPOSITO">Depósito</option>
            <option value="CORRECCION">Corrección</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <FormField id="turno-concepto-movimiento" label="Concepto (opcional)" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={registrar.isPending} className="w-full">
          {registrar.isPending ? 'Registrando…' : 'Registrar'}
        </Button>
      </form>
    </Modal>
  );
}

// Billetes/monedas en circulación en RD$ — cierre por denominación en vez
// de un solo campo "monto contado" (más preciso para el arqueo real).
const DENOMINACIONES = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1];

function ModalCerrarTurno({
  data,
  onClose,
  onCerrado,
}: {
  data: TurnoCajaDetalleData;
  onClose: () => void;
  onCerrado: () => void;
}) {
  const [conteo, setConteo] = useState<Record<number, string>>({});
  const [justificacionDiferencia, setJustificacionDiferencia] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const algoContado = Object.values(conteo).some((v) => v.trim() !== '');
  const montoFinalContado = DENOMINACIONES.reduce((acc, d) => acc + d * (Number(conteo[d]) || 0), 0);

  const montoEsperado = calcularMontoEsperado(data);
  const TOLERANCIA_REFERENCIA = 50; // RD$ — default documentado de Configuracion.POS_TOLERANCIA_ARQUEO; el backend valida el real
  const diferencia = algoContado ? montoFinalContado - montoEsperado : null;
  const dentroDeTolerancia = diferencia === null || Math.abs(diferencia) <= TOLERANCIA_REFERENCIA;

  const cerrarTurno = useMutation({
    mutationFn: async () =>
      apiClient.post(`/pos/turnos/${data.id}/cerrar`, {
        montoFinalContado,
        justificacionDiferencia: justificacionDiferencia || undefined,
        pin: pin || undefined,
      }),
    onSuccess: () => onCerrado(),
    onError: (err: unknown) => setError(mensajeErrorApi(err, 'No se pudo cerrar el turno.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!algoContado) {
      setError('Contá al menos una denominación.');
      return;
    }
    cerrarTurno.mutate();
  }

  return (
    <Modal titulo="Cerrar turno" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Efectivo esperado según ventas y movimientos: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatoRD(montoEsperado)}</span>
        </p>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Efectivo contado (por denominación)</p>
          <div className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-800">
            {DENOMINACIONES.map((d) => (
              <div key={d} className="flex items-center justify-between gap-2 text-sm">
                <label htmlFor={`denominacion-${d}`} className="text-slate-600 dark:text-slate-400">
                  {formatoRD(d)}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`denominacion-${d}`}
                    type="number"
                    min={0}
                    step={1}
                    value={conteo[d] ?? ''}
                    onChange={(e) => setConteo((prev) => ({ ...prev, [d]: e.target.value }))}
                    className="w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <span className="w-20 shrink-0 text-right text-xs text-slate-400">
                    {formatoRD(d * (Number(conteo[d]) || 0))}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
            Total contado: {formatoRD(montoFinalContado)}
          </p>
        </div>

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
        <CampoPin value={pin} onChange={setPin} id="cerrar-turno-pin" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variante="peligro" disabled={cerrarTurno.isPending} className="w-full">
          {cerrarTurno.isPending ? 'Cerrando…' : 'Cerrar turno'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalAnularVenta({ factura, onClose, onAnulada }: { factura: FacturaTurno; onClose: () => void; onAnulada: () => void }) {
  const { usuario } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [pin, setPin] = useState('');
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const anular = useMutation({
    mutationFn: async () =>
      apiClient.post(`/facturas/${factura.id}/anular`, { motivo, pin: pin || undefined, codigoAutorizacion: codigoAutorizacion || undefined }),
    onSuccess: () => onAnulada(),
    onError: (err: unknown) => setError(mensajeErrorApi(err, 'No se pudo anular la venta.')),
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
        <CampoPin value={pin} onChange={setPin} id="anular-venta-pin" />
        <CampoCodigoAutorizacion
          requerido={usuario?.requiereAutorizacionAnular}
          solicitarUrl={`/facturas/${factura.id}/solicitar-autorizacion`}
          value={codigoAutorizacion}
          onChange={setCodigoAutorizacion}
          id="anular-venta-codigo-autorizacion"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variante="peligro" disabled={anular.isPending} className="w-full">
          {anular.isPending ? 'Anulando…' : 'Anular venta'}
        </Button>
      </form>
    </Modal>
  );
}
