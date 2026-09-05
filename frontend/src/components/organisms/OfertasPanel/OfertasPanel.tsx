import { FormEvent, useState } from 'react';
import { Package } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { SelectCategoria } from '../../molecules/SelectCategoria/SelectCategoria';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { PaginaResultado } from '../../../types/pagina-resultado';

type TipoDescuento = 'PORCENTAJE' | 'MONTO_FIJO' | 'BOGO';
type Alcance = 'PRODUCTO' | 'CATEGORIA' | 'CARRITO';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
}

interface Oferta {
  id: string;
  nombre: string;
  tipoDescuento: TipoDescuento;
  valor: string | null;
  comprarCantidad: number | null;
  llevarCantidad: number | null;
  porcentajeDescuentoLlevar: string | null;
  descuentoMaximoMonto: string | null;
  acumulable: boolean;
  prioridad: number;
  pagaComision: boolean;
  alcance: Alcance;
  producto: { id: string; codigo: string; nombre: string } | null;
  categoria: { id: string; nombre: string } | null;
  montoMinimoCarrito: string | null;
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
}

function mensajeError(err: unknown, fallback: string): string {
  const mensaje =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;
  return mensaje ?? fallback;
}

function etiquetaAlcance(o: Oferta): string {
  if (o.alcance === 'PRODUCTO') return o.producto ? `Producto: ${o.producto.nombre}` : 'Producto';
  if (o.alcance === 'CATEGORIA') return o.categoria ? `Categoría: ${o.categoria.nombre}` : 'Categoría';
  return o.montoMinimoCarrito ? `Carrito ≥ RD$ ${Number(o.montoMinimoCarrito).toLocaleString('es-DO')}` : 'Carrito (sin mínimo)';
}

function etiquetaDescuento(o: Oferta): string {
  if (o.tipoDescuento === 'PORCENTAJE') return `${Number(o.valor)}%`;
  if (o.tipoDescuento === 'MONTO_FIJO') return `RD$ ${Number(o.valor).toLocaleString('es-DO')}`;
  const pct = o.porcentajeDescuentoLlevar == null ? 100 : Number(o.porcentajeDescuentoLlevar);
  return `Compra ${o.comprarCantidad} Lleva ${o.llevarCantidad}${pct < 100 ? ` (${pct}% off)` : ''}`;
}

function estaVencida(o: Oferta): boolean {
  return new Date(o.fechaFin) < new Date();
}

// Ítem A-2 — `fechaInicio`/`fechaFin` ahora admiten hora exacta
// (`datetime-local`, sin timezone propio). Formatear con la zona horaria
// local del navegador es correcto porque el valor se guardó como el
// instante UTC exacto que representaba esa hora local al crearla (ver
// `aFechaHoraUtc`) — a diferencia del viejo date-only, que se guardaba a
// medianoche UTC y por eso necesitaba forzar 'UTC' al mostrarlo.
function formatearFechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
}

/** input[type=datetime-local] no lleva timezone — Date lo interpreta en la hora LOCAL del navegador, que es la intención real del usuario; toISOString() lo fija a un instante UTC preciso antes de mandarlo. */
function aFechaHoraUtc(valorLocal: string): string {
  return new Date(valorLocal).toISOString();
}

/**
 * Motor de ofertas (Fase 4b de adopción de Cuadre): descuentos automáticos
 * por producto, categoría o carrito completo, resueltos al facturar/
 * cotizar (ver OfertasService) — este panel es solo el CRUD, la lógica de
 * negocio vive 100% en el backend.
 */
export function OfertasPanel() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [tipoDescuento, setTipoDescuento] = useState<TipoDescuento>('PORCENTAJE');
  const [valor, setValor] = useState('');
  const [comprarCantidad, setComprarCantidad] = useState('');
  const [llevarCantidad, setLlevarCantidad] = useState('');
  const [porcentajeDescuentoLlevar, setPorcentajeDescuentoLlevar] = useState('100');
  const [descuentoMaximoMonto, setDescuentoMaximoMonto] = useState('');
  const [acumulable, setAcumulable] = useState(false);
  const [prioridad, setPrioridad] = useState('0');
  const [pagaComision, setPagaComision] = useState(true);
  const [alcance, setAlcance] = useState<Alcance>('PRODUCTO');
  const [producto, setProducto] = useState<Producto | null>(null);
  const [categoriaId, setCategoriaId] = useState('');
  const [montoMinimoCarrito, setMontoMinimoCarrito] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: ofertas } = useQuery({
    queryKey: ['ofertas'],
    queryFn: async () => (await apiClient.get<Oferta[]>('/ofertas')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['ofertas'] });
  }

  function limpiar() {
    setNombre('');
    setValor('');
    setComprarCantidad('');
    setLlevarCantidad('');
    setPorcentajeDescuentoLlevar('100');
    setDescuentoMaximoMonto('');
    setAcumulable(false);
    setPrioridad('0');
    setPagaComision(true);
    setProducto(null);
    setCategoriaId('');
    setMontoMinimoCarrito('');
    setFechaInicio('');
    setFechaFin('');
    setError(null);
  }

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/ofertas', {
        nombre,
        tipoDescuento,
        valor: tipoDescuento === 'BOGO' ? undefined : Number(valor),
        comprarCantidad: tipoDescuento === 'BOGO' ? Number(comprarCantidad) : undefined,
        llevarCantidad: tipoDescuento === 'BOGO' ? Number(llevarCantidad) : undefined,
        porcentajeDescuentoLlevar: tipoDescuento === 'BOGO' ? Number(porcentajeDescuentoLlevar) : undefined,
        descuentoMaximoMonto: descuentoMaximoMonto ? Number(descuentoMaximoMonto) : undefined,
        acumulable,
        prioridad: Number(prioridad) || 0,
        pagaComision,
        alcance,
        productoId: alcance === 'PRODUCTO' ? producto?.id : undefined,
        categoriaId: alcance === 'CATEGORIA' ? categoriaId : undefined,
        montoMinimoCarrito: alcance === 'CARRITO' && montoMinimoCarrito ? Number(montoMinimoCarrito) : undefined,
        fechaInicio: aFechaHoraUtc(fechaInicio),
        fechaFin: aFechaHoraUtc(fechaFin),
      }),
    onSuccess: () => {
      invalidar();
      limpiar();
    },
    onError: (err: unknown) => setError(mensajeError(err, 'No se pudo crear la oferta.')),
  });

  const actualizarActiva = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => apiClient.patch(`/ofertas/${id}`, { activa }),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/ofertas/${id}`),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (alcance === 'PRODUCTO' && !producto) {
      setError('Elegí un producto.');
      return;
    }
    if (alcance === 'CATEGORIA' && !categoriaId) {
      setError('Elegí una categoría.');
      return;
    }
    if (tipoDescuento === 'BOGO' && (!comprarCantidad || !llevarCantidad)) {
      setError('Indicá cuántas unidades hay que comprar y cuántas se llevan con descuento.');
      return;
    }
    if (tipoDescuento === 'BOGO' && alcance === 'CARRITO') {
      setError('BOGO no aplica a ofertas de carrito completo — elegí un producto o categoría.');
      return;
    }
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nueva oferta">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="oferta-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Alcance</label>
            <select
              value={alcance}
              onChange={(e) => setAlcance(e.target.value as Alcance)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="PRODUCTO">Un producto específico</option>
              <option value="CATEGORIA">Una categoría completa</option>
              <option value="CARRITO">Carrito/factura completa</option>
            </select>
          </div>

          {alcance === 'PRODUCTO' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
              <ComboboxBusqueda<Producto>
                valor={producto}
                onSeleccionar={setProducto}
                obtenerId={(p) => p.id}
                obtenerEtiqueta={(p) => `${p.codigo} — ${p.nombre}`}
                placeholder="Buscar producto…"
                icono={<Package size={15} />}
                buscar={async (texto) =>
                  (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
                }
              />
            </div>
          )}

          {alcance === 'CATEGORIA' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Categoría</label>
              <SelectCategoria value={categoriaId} onChange={setCategoriaId} />
            </div>
          )}

          {alcance === 'CARRITO' && (
            <FormField
              id="oferta-monto-minimo"
              label="Monto mínimo de compra (opcional)"
              type="number"
              min={0}
              step="0.01"
              value={montoMinimoCarrito}
              onChange={(e) => setMontoMinimoCarrito(e.target.value)}
              placeholder="Sin mínimo — siempre aplica"
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
              <select
                value={tipoDescuento}
                onChange={(e) => setTipoDescuento(e.target.value as TipoDescuento)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="PORCENTAJE">% Porcentaje</option>
                <option value="MONTO_FIJO">RD$ Monto fijo</option>
                <option value="BOGO">Compra X Lleva Y / Segunda unidad</option>
              </select>
            </div>
            {tipoDescuento !== 'BOGO' && (
              <FormField
                id="oferta-valor"
                label={tipoDescuento === 'PORCENTAJE' ? 'Descuento %' : 'Descuento RD$'}
                type="number"
                min={0}
                max={tipoDescuento === 'PORCENTAJE' ? 100 : undefined}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            )}
          </div>

          {tipoDescuento === 'BOGO' && (
            <div className="grid grid-cols-3 gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <FormField id="oferta-comprar" label="Compra (unidades)" type="number" min={1} value={comprarCantidad} onChange={(e) => setComprarCantidad(e.target.value)} required />
              <FormField id="oferta-llevar" label="Lleva (unidades)" type="number" min={1} value={llevarCantidad} onChange={(e) => setLlevarCantidad(e.target.value)} required />
              <FormField
                id="oferta-pct-llevar"
                label="% desc. en llevadas"
                type="number"
                min={0}
                max={100}
                value={porcentajeDescuentoLlevar}
                onChange={(e) => setPorcentajeDescuentoLlevar(e.target.value)}
                required
              />
              <p className="col-span-3 text-xs text-slate-500 dark:text-slate-400">
                100% = gratis (BOGO clásico); 50% = "segunda unidad a mitad de precio" (comprar 1, llevar 1).
              </p>
            </div>
          )}

          <FormField
            id="oferta-tope"
            label="Tope de descuento en RD$ (opcional)"
            type="number"
            min={0}
            step="0.01"
            value={descuentoMaximoMonto}
            onChange={(e) => setDescuentoMaximoMonto(e.target.value)}
            placeholder="Sin tope"
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={acumulable} onChange={(e) => setAcumulable(e.target.checked)} />
              Acumulable con otras ofertas
            </label>
            <FormField id="oferta-prioridad" label="Prioridad (menor = primero)" type="number" value={prioridad} onChange={(e) => setPrioridad(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={pagaComision} onChange={(e) => setPagaComision(e.target.checked)} />
            Cuenta para la comisión del vendedor
          </label>

          <div className="grid grid-cols-2 gap-2">
            <FormField id="oferta-inicio" label="Vigente desde" type="datetime-local" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
            <FormField id="oferta-fin" label="Vigente hasta" type="datetime-local" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear oferta'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Ofertas">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Alcance</th>
              <th className="px-5 py-3 font-medium">Descuento</th>
              <th className="px-5 py-3 font-medium">Vigencia</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {ofertas?.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                  {o.nombre}
                  {o.acumulable && <span className="ml-1 text-xs text-slate-400">(acumulable)</span>}
                </td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{etiquetaAlcance(o)}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{etiquetaDescuento(o)}</td>
                <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {formatearFechaHora(o.fechaInicio)} – {formatearFechaHora(o.fechaFin)}
                </td>
                <td className="px-5 py-3">
                  {!o.activa ? (
                    <Badge tono="neutro">Inactiva</Badge>
                  ) : estaVencida(o) ? (
                    <Badge tono="advertencia">Vencida</Badge>
                  ) : (
                    <Badge tono="exito">Activa</Badge>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => actualizarActiva.mutate({ id: o.id, activa: !o.activa })}
                      className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                    >
                      {o.activa ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar.mutate(o.id)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {ofertas?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  Sin ofertas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
