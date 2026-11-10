import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { CampoImagen } from '../components/molecules/CampoImagen/CampoImagen';
import { GaleriaImagenes } from '../components/molecules/GaleriaImagenes/GaleriaImagenes';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { CardColapsable } from '../components/molecules/CardColapsable/CardColapsable';
import { SelectCategoria } from '../components/molecules/SelectCategoria/SelectCategoria';
import { SelectLeyFiscal } from '../components/molecules/SelectLeyFiscal/SelectLeyFiscal';
import { VariantesProductoPanel } from '../components/organisms/VariantesProductoPanel/VariantesProductoPanel';
import { useHayCambios } from '../hooks/useHayCambios';
import { useAuth } from '../hooks/useAuth';
import type { AjusteImagen } from '../constants/ajuste-imagen';
import { PaginaResultado } from '../types/pagina-resultado';

export type TipoProducto = 'PRODUCTO' | 'SERVICIO' | 'COMBO';

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  categoriaId: string | null;
  categoria: { id: string; nombre: string } | null;
  unidadMedida: string;
  porcentajeItbis: string;
  leyFiscalId: string | null;
  tipo: TipoProducto;
  controlaVencimiento: boolean;
  precioVariable: boolean;
  esIngrediente: boolean;
  permiteDevolucion: boolean;
  porcentajeComision: string | null;
  montoComisionFijo: string | null;
  destacado: boolean;
}

interface ComponenteComboDetalle {
  cantidad: string;
  componente: { id: string; codigo: string; nombre: string };
}

interface UnidadMedidaCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
}

interface UnidadConversionDetalle {
  unidadMedidaId: string;
  factorConversion: string;
  unidadMedida: { id: string; codigo: string; nombre: string };
}

export interface ProductoDetalle extends Producto {
  componentes: ComponenteComboDetalle[];
  imagen: string | null;
  imagenAjuste: AjusteImagen;
  descripcionTienda: string | null;
  imagenesAdicionales: { imagen: string }[];
  unidadMedidaBaseId: string | null;
  unidadesConversion: UnidadConversionDetalle[];
}

interface ProductoFormValues {
  codigo: string;
  nombre: string;
  categoriaId: string;
  unidadMedida: string;
  unidadMedidaBaseId: string;
  porcentajeItbis: string;
  leyFiscalId: string;
  tipo: TipoProducto;
  imagen: string | null;
  imagenAjuste: AjusteImagen;
  descripcionTienda: string;
  imagenesAdicionales: string[];
  controlaVencimiento: boolean;
  precioVariable: boolean;
  esIngrediente: boolean;
  permiteDevolucion: boolean;
  porcentajeComision: string;
  montoComisionFijo: string;
  destacado: boolean;
}

/** Plan de integración Cuadre, ítem E-8 — lista cerrada (antes texto libre sin validar), igual orden que UNIDADES_MEDIDA en el backend. */
const UNIDADES_MEDIDA: { value: string; label: string }[] = [
  { value: 'UND', label: 'Unidad' },
  { value: 'KILOGRAMO', label: 'Kilogramo' },
  { value: 'GRAMO', label: 'Gramo' },
  { value: 'LIBRA', label: 'Libra' },
  { value: 'ONZA', label: 'Onza' },
  { value: 'LITRO', label: 'Litro' },
  { value: 'MILILITRO', label: 'Mililitro' },
  { value: 'GALON', label: 'Galón' },
  { value: 'PORCION', label: 'Porción' },
  { value: 'DOCENA', label: 'Docena' },
];

interface ComponenteComboForm {
  productoId: string;
  cantidad: string;
}

interface UnidadConversionForm {
  unidadMedidaId: string;
  factorConversion: string;
}

const PRODUCTO_VACIO: ProductoFormValues = {
  codigo: '',
  nombre: '',
  categoriaId: '',
  unidadMedida: 'UND',
  unidadMedidaBaseId: '',
  porcentajeItbis: '18',
  leyFiscalId: '',
  tipo: 'PRODUCTO',
  imagen: null,
  imagenAjuste: 'COVER',
  descripcionTienda: '',
  imagenesAdicionales: [],
  controlaVencimiento: false,
  precioVariable: false,
  esIngrediente: false,
  permiteDevolucion: true,
  porcentajeComision: '',
  montoComisionFijo: '',
  destacado: false,
};

function valoresDesdeDetalle(d: ProductoDetalle): ProductoFormValues {
  return {
    codigo: d.codigo,
    nombre: d.nombre,
    categoriaId: d.categoriaId ?? '',
    unidadMedida: d.unidadMedida,
    unidadMedidaBaseId: d.unidadMedidaBaseId ?? '',
    porcentajeItbis: d.porcentajeItbis,
    leyFiscalId: d.leyFiscalId ?? '',
    tipo: d.tipo,
    imagen: d.imagen,
    imagenAjuste: d.imagenAjuste,
    descripcionTienda: d.descripcionTienda ?? '',
    imagenesAdicionales: d.imagenesAdicionales.map((i) => i.imagen),
    controlaVencimiento: d.controlaVencimiento,
    precioVariable: d.precioVariable,
    esIngrediente: d.esIngrediente,
    permiteDevolucion: d.permiteDevolucion,
    porcentajeComision: d.porcentajeComision ?? '',
    montoComisionFijo: d.montoComisionFijo ?? '',
    destacado: d.destacado,
  };
}

/**
 * Benchmark 2026-11-09 (Fase 7.1) — reemplaza el `FormularioProducto` que
 * vivía dentro de un `Modal` en `Productos.tsx`. Mismo criterio de diseño
 * visto en vivo en Alegra: el alta/edición/vista de un producto es una
 * PÁGINA real (`/productos/nuevo`, `/productos/:id`, `/productos/:id/editar`),
 * no un modal — el modal corto queda reservado solo para el alta rápida al
 * vuelo desde dentro de otro documento (Fase 7.4, todavía no implementada).
 *
 * Un solo componente cubre los 3 modos (crear/ver/editar) para no duplicar
 * el mapeo de ~20 campos tres veces — `soloLectura` deshabilita los
 * controles y oculta las acciones de edición cuando el modo es "ver".
 */
export function ProductoFormulario() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const modo: 'crear' | 'ver' | 'editar' = !id ? 'crear' : location.pathname.endsWith('/editar') ? 'editar' : 'ver';
  const soloLectura = modo === 'ver';

  const { data: detalle } = useQuery({
    queryKey: ['producto', id],
    queryFn: async () => (await apiClient.get<ProductoDetalle>(`/productos/${id}`)).data,
    enabled: !!id,
  });

  const [valores, setValores] = useState<ProductoFormValues>(PRODUCTO_VACIO);
  const [componentes, setComponentes] = useState<ComponenteComboForm[]>([]);
  const [conversiones, setConversiones] = useState<UnidadConversionForm[]>([]);
  const [usaConversionUnidades, setUsaConversionUnidades] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tienePermiso } = useAuth();
  const [candidatosIa, setCandidatosIa] = useState<{ nombre: string; descripcion: string }[] | null>(null);
  const [errorIa, setErrorIa] = useState<string | null>(null);
  const [detalleIa, setDetalleIa] = useState('');
  const [infoColapsada, setInfoColapsada] = useState(false);
  const [tiendaColapsada, setTiendaColapsada] = useState(false);
  const [ventasColapsada, setVentasColapsada] = useState(false);

  useEffect(() => {
    if (!detalle) return;
    setValores(valoresDesdeDetalle(detalle));
    if (detalle.tipo === 'COMBO') {
      setComponentes(detalle.componentes.map((c) => ({ productoId: c.componente.id, cantidad: c.cantidad })));
    }
    setConversiones(detalle.unidadesConversion.map((u) => ({ unidadMedidaId: u.unidadMedidaId, factorConversion: u.factorConversion })));
    setUsaConversionUnidades(!!detalle.unidadMedidaBaseId);
  }, [detalle]);

  const { data: unidadesMedida } = useQuery({
    queryKey: ['unidades-medida-activas'],
    queryFn: async () => (await apiClient.get<UnidadMedidaCatalogo[]>('/unidades-medida', { params: { activa: 'true' } })).data,
  });
  const opcionesConversion = (unidadesMedida ?? []).filter((u) => u.id !== valores.unidadMedidaBaseId);

  function actualizarConversion(i: number, cambios: Partial<UnidadConversionForm>) {
    setConversiones((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...cambios } : c)));
  }

  const { data: productosDisponibles } = useQuery({
    queryKey: ['productos-select-combo'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 200 } })).data.datos,
    enabled: valores.tipo === 'COMBO',
  });
  const opcionesComponente = (productosDisponibles ?? []).filter((p) => p.tipo !== 'COMBO' && p.id !== id);

  function actualizarComponente(i: number, cambios: Partial<ComponenteComboForm>) {
    setComponentes((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...cambios } : c)));
  }

  function payload() {
    return {
      codigo: valores.codigo,
      nombre: valores.nombre,
      categoriaId: valores.categoriaId || null,
      unidadMedida: valores.unidadMedida || undefined,
      unidadMedidaBaseId: valores.unidadMedidaBaseId || null,
      unidadesConversion: valores.unidadMedidaBaseId
        ? conversiones.filter((c) => c.unidadMedidaId).map((c) => ({ unidadMedidaId: c.unidadMedidaId, factorConversion: Number(c.factorConversion) || 1 }))
        : [],
      porcentajeItbis: valores.porcentajeItbis ? Number(valores.porcentajeItbis) : undefined,
      leyFiscalId: valores.leyFiscalId || null,
      tipo: valores.tipo,
      imagen: valores.imagen,
      imagenAjuste: valores.imagenAjuste,
      descripcionTienda: valores.descripcionTienda || null,
      imagenesAdicionales: valores.imagenesAdicionales.map((imagen) => ({ imagen })),
      controlaVencimiento: valores.tipo === 'PRODUCTO' ? valores.controlaVencimiento : false,
      precioVariable: valores.precioVariable,
      esIngrediente: valores.esIngrediente,
      permiteDevolucion: valores.permiteDevolucion,
      porcentajeComision: valores.porcentajeComision ? Number(valores.porcentajeComision) : null,
      montoComisionFijo: valores.montoComisionFijo ? Number(valores.montoComisionFijo) : null,
      destacado: valores.destacado,
      componentes:
        valores.tipo === 'COMBO'
          ? componentes.filter((c) => c.productoId).map((c) => ({ productoId: c.productoId, cantidad: Number(c.cantidad) || 1 }))
          : undefined,
    };
  }

  const guardar = useMutation({
    mutationFn: async () => (id ? apiClient.patch(`/productos/${id}`, payload()) : apiClient.post('/productos', payload())),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      queryClient.invalidateQueries({ queryKey: ['producto', id] });
      confirmarGuardado();
      const nuevoId = (data as { id?: string })?.id ?? id;
      setTimeout(() => navigate(nuevoId ? `/productos/${nuevoId}` : '/productos'), 0);
    },
    onError: (err) =>
      setError(
        mensajeErrorApi(
          err,
          'No se pudo guardar el producto. Revisa los datos (un combo necesita al menos un componente, y no puede incluirse a sí mismo ni a otro combo).',
        ),
      ),
  });

  const analizarConIa = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ opciones: { nombre: string; descripcion: string }[] }>('/productos/analizar-imagen', {
          imagen: valores.imagen,
          detalle: detalleIa.trim() || undefined,
        })
      ).data,
    onSuccess: (data) => {
      setCandidatosIa(data.opciones);
      queryClient.invalidateQueries({ queryKey: ['ia-uso-mensual'] });
    },
    onError: (err) => setErrorIa(mensajeErrorApi(err, 'No se pudo generar con IA — probá de nuevo.')),
  });

  const { data: usoIa } = useQuery({
    queryKey: ['ia-uso-mensual'],
    queryFn: async () => (await apiClient.get<{ imagenProducto: { usados: number; limite: number } }>('/ia/uso-mensual')).data,
    enabled: tienePermiso('productos.ia_generar'),
    staleTime: 60 * 1000,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (valores.tipo === 'COMBO' && componentes.filter((c) => c.productoId).length === 0) {
      setError('Un combo necesita al menos un componente.');
      return;
    }
    if (valores.porcentajeComision && valores.montoComisionFijo) {
      setError('Elegí % de comisión o monto fijo, no ambos.');
      return;
    }
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ valores, componentes, conversiones }, modo !== 'ver' && (!id || !!detalle));

  const titulo = modo === 'crear' ? 'Nuevo producto' : modo === 'editar' ? 'Editar producto' : valores.nombre || 'Producto';

  return (
    <PaginaDocumento
      titulo={titulo}
      rutaVolver="/productos"
      etiquetaVolver="Volver a Productos"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Código</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{valores.codigo || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ PRODUCTO: 'Producto', SERVICIO: 'Servicio', COMBO: 'Combo' }[valores.tipo]}
            </span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {soloLectura ? (
            <Button type="button" className="w-full" onClick={() => navigate(`/productos/${id}/editar`)}>
              Editar
            </Button>
          ) : (
            <Button type="submit" form="form-producto" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          )}
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(id ? `/productos/${id}` : '/productos')}>
            {soloLectura ? 'Volver' : 'Cancelar'}
          </Button>
        </>
      }
    >
      <form id="form-producto" onSubmit={onSubmit} className="space-y-4">
        <CardColapsable
          titulo="Información general"
          colapsada={infoColapsada}
          onToggle={() => setInfoColapsada((v) => !v)}
          resumen={`${valores.nombre || 'Sin nombre'} · ${valores.codigo || 'sin código'}`}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="producto-tipo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo
            </label>
            <Select
              id="producto-tipo"
              value={valores.tipo}
              disabled={soloLectura || modo === 'editar'}
              onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoProducto }))}
            >
              <option value="PRODUCTO">Producto (mueve inventario)</option>
              <option value="SERVICIO">Servicio (no mueve inventario)</option>
              <option value="COMBO">Combo (bundle de otros productos)</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <FormField
                id="producto-codigo"
                label="Código"
                value={valores.codigo}
                disabled={soloLectura}
                onChange={(e) => setValores((v) => ({ ...v, codigo: e.target.value }))}
                required
              />
            </div>
            {!soloLectura && (
              <Button
                type="button"
                variante="secundario"
                onClick={async () => {
                  const { data } = await apiClient.post<{ valor: string }>('/admin/correlativos/PRODUCTO/siguiente');
                  setValores((v) => ({ ...v, codigo: data.valor }));
                }}
              >
                Asignar
              </Button>
            )}
          </div>
          <FormField
            id="producto-nombre"
            label="Nombre"
            value={valores.nombre}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
            required
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="producto-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Categoría
            </label>
            <SelectCategoria
              id="producto-categoria"
              value={valores.categoriaId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, categoriaId: id }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="producto-unidad" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Unidad de medida
            </label>
            <Select
              id="producto-unidad"
              value={valores.unidadMedida}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, unidadMedida: e.target.value }))}
            >
              {UNIDADES_MEDIDA.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={usaConversionUnidades}
              disabled={soloLectura}
              onChange={(e) => {
                const activar = e.target.checked;
                setUsaConversionUnidades(activar);
                if (!activar) {
                  setValores((v) => ({ ...v, unidadMedidaBaseId: '' }));
                  setConversiones([]);
                }
              }}
            />
            Este producto se compra o vende en más de una unidad (ej. por Caja además de por Unidad)
          </label>

          {usaConversionUnidades && (
            <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800 sm:col-span-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="producto-unidad-base" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Unidad base
                </label>
                <Select
                  id="producto-unidad-base"
                  value={valores.unidadMedidaBaseId}
                  disabled={soloLectura}
                  onChange={(e) => setValores((v) => ({ ...v, unidadMedidaBaseId: e.target.value }))}
                >
                  <option value="">Elegir…</option>
                  {(unidadesMedida ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Es la unidad en la que vive el stock de este producto (distinta del campo "Unidad de medida" de
                  arriba, que es solo texto informativo). Las unidades de conversión de abajo son alternativas para
                  comprar/vender este producto — ej. "Caja" = 144 unidades de esta base.
                </p>
              </div>

              {valores.unidadMedidaBaseId && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Unidades de conversión (ej. "Caja" = 144 unidades de la base)
                  </p>
                  {conversiones.map((conversion, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={conversion.unidadMedidaId}
                        disabled={soloLectura}
                        onChange={(e) => actualizarConversion(i, { unidadMedidaId: e.target.value })}
                        required
                        className="min-w-[160px] flex-1"
                      >
                        <option value="">Unidad…</option>
                        {opcionesConversion.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </Select>
                      <span className="text-xs text-slate-500 dark:text-slate-400">=</span>
                      <input
                        type="number"
                        min={0.0001}
                        step="0.0001"
                        placeholder="Factor"
                        value={conversion.factorConversion}
                        disabled={soloLectura}
                        onChange={(e) => actualizarConversion(i, { factorConversion: e.target.value })}
                        className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">unidades base</span>
                      {!soloLectura && (
                        <button
                          type="button"
                          onClick={() => setConversiones((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          aria-label="Quitar unidad de conversión"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {!soloLectura && (
                    <button
                      type="button"
                      onClick={() => setConversiones((prev) => [...prev, { unidadMedidaId: '', factorConversion: '1' }])}
                      className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
                    >
                      + Agregar unidad de conversión
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={valores.porcentajeItbis === '0'}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, porcentajeItbis: e.target.checked ? '0' : '18' }))}
            />
            Exento de impuesto (ITBIS)
          </label>
          {valores.porcentajeItbis === '0' ? (
            <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
              Este producto no lleva ITBIS — el precio que le asignes es exactamente lo que paga el cliente, sin
              ningún cargo adicional.
            </p>
          ) : (
            <FormField
              id="producto-itbis"
              label="ITBIS %"
              type="number"
              min={0}
              max={100}
              value={valores.porcentajeItbis}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, porcentajeItbis: e.target.value }))}
            />
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="producto-ley-fiscal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Ley fiscal (opcional, plan de integración Cuadre, ítem B-3)
            </label>
            <SelectLeyFiscal
              id="producto-ley-fiscal"
              value={valores.leyFiscalId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, leyFiscalId: id }))}
            />
          </div>

          {valores.tipo === 'PRODUCTO' && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={valores.controlaVencimiento}
                disabled={soloLectura}
                onChange={(e) => setValores((v) => ({ ...v, controlaVencimiento: e.target.checked }))}
              />
              Controla vencimiento (lotes con fecha de vencimiento, consumo FEFO en ventas)
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={valores.precioVariable}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, precioVariable: e.target.checked }))}
            />
            Precio variable (habilita un precio editable por línea en el carrito del POS)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={valores.esIngrediente}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, esIngrediente: e.target.checked }))}
            />
            Es ingrediente (informativo)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={valores.permiteDevolucion}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, permiteDevolucion: e.target.checked }))}
            />
            Permite devolución (Nota de Crédito)
          </label>
        </CardColapsable>

        <CardColapsable
          titulo="Tienda online"
          colapsada={tiendaColapsada}
          onToggle={() => setTiendaColapsada((v) => !v)}
          resumen={valores.destacado ? 'Destacado en la Tienda Online' : 'Imagen, galería y descripción'}
        >
          <div className="sm:col-span-2">
            {soloLectura ? (
              valores.imagen ? (
                <img src={valores.imagen} alt={valores.nombre} className="h-32 w-32 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              ) : (
                <p className="text-sm text-slate-400">Sin foto</p>
              )
            ) : (
              <CampoImagen
                valor={valores.imagen}
                onChange={(imagen) => setValores((v) => ({ ...v, imagen }))}
                ajuste={valores.imagenAjuste}
                onChangeAjuste={(imagenAjuste) => setValores((v) => ({ ...v, imagenAjuste }))}
              />
            )}
          </div>
          {!soloLectura && tienePermiso('productos.ia_generar') && valores.imagen && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <input
                type="text"
                value={detalleIa}
                onChange={(e) => setDetalleIa(e.target.value)}
                maxLength={300}
                placeholder="Detalle breve del producto (opcional) — marca, material, talla, uso… ayuda a la IA a acertar mejor"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variante="secundario"
                  onClick={() => {
                    setErrorIa(null);
                    analizarConIa.mutate();
                  }}
                  disabled={analizarConIa.isPending || (usoIa ? usoIa.imagenProducto.usados >= usoIa.imagenProducto.limite : false)}
                  className="flex items-center gap-1.5 self-start"
                >
                  <Sparkles size={14} />
                  {analizarConIa.isPending ? 'Analizando imagen…' : 'Generar con IA'}
                </Button>
                {usoIa && (
                  <span className="text-xs text-slate-400">
                    Te quedan {Math.max(0, usoIa.imagenProducto.limite - usoIa.imagenProducto.usados)} de{' '}
                    {usoIa.imagenProducto.limite} este mes
                  </span>
                )}
              </div>
              {errorIa && <p className="text-xs text-red-600 dark:text-red-400">{errorIa}</p>}
            </div>
          )}
          <div className="sm:col-span-2">
            {soloLectura ? (
              valores.imagenesAdicionales.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {valores.imagenesAdicionales.map((img, i) => (
                    <img key={i} src={img} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sin fotos adicionales</p>
              )
            ) : (
              <GaleriaImagenes
                valores={valores.imagenesAdicionales}
                onChange={(imagenesAdicionales) => setValores((v) => ({ ...v, imagenesAdicionales }))}
              />
            )}
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="producto-descripcion-tienda" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Descripción para la Tienda Online
            </label>
            <textarea
              id="producto-descripcion-tienda"
              value={valores.descripcionTienda}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, descripcionTienda: e.target.value }))}
              rows={5}
              placeholder="Detalle del producto que ve el comprador en el storefront público (opcional)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={valores.destacado}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, destacado: e.target.checked }))}
              className="h-4 w-4 rounded"
            />
            Destacar en la Tienda Online
          </label>
        </CardColapsable>

        <CardColapsable
          titulo="Comisión y combo"
          colapsada={ventasColapsada}
          onToggle={() => setVentasColapsada((v) => !v)}
          resumen="Comisión de venta y, si es combo, sus componentes"
        >
          <div className="sm:col-span-2 space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Comisión de venta (ítem A-1) — elegí % o monto fijo, no ambos
            </p>
            <div className="grid grid-cols-2 gap-2">
              <FormField
                id="producto-comision-pct"
                label="% de comisión"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={valores.porcentajeComision}
                disabled={soloLectura}
                onChange={(e) =>
                  setValores((v) => ({ ...v, porcentajeComision: e.target.value, montoComisionFijo: e.target.value ? '' : v.montoComisionFijo }))
                }
              />
              <FormField
                id="producto-comision-fija"
                label="Monto fijo (RD$)"
                type="number"
                min={0}
                step="0.01"
                value={valores.montoComisionFijo}
                disabled={soloLectura}
                onChange={(e) =>
                  setValores((v) => ({ ...v, montoComisionFijo: e.target.value, porcentajeComision: e.target.value ? '' : v.porcentajeComision }))
                }
              />
            </div>
          </div>

          {valores.tipo === 'COMBO' && (
            <div className="sm:col-span-2 space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Componentes (se descuentan del inventario al facturar el combo)
              </p>
              {componentes.map((componente, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <Select
                    value={componente.productoId}
                    disabled={soloLectura}
                    onChange={(e) => actualizarComponente(i, { productoId: e.target.value })}
                    required
                    className="min-w-[160px] flex-1"
                  >
                    <option value="">Producto…</option>
                    {opcionesComponente.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} — {p.nombre} {p.tipo === 'SERVICIO' ? '(servicio)' : ''}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    placeholder="Cant."
                    value={componente.cantidad}
                    disabled={soloLectura}
                    onChange={(e) => actualizarComponente(i, { cantidad: e.target.value })}
                    className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {!soloLectura && (
                    <button
                      type="button"
                      onClick={() => setComponentes((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      aria-label="Quitar componente"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!soloLectura && (
                <button
                  type="button"
                  onClick={() => setComponentes((prev) => [...prev, { productoId: '', cantidad: '1' }])}
                  className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
                >
                  + Agregar componente
                </button>
              )}
            </div>
          )}

          {valores.tipo === 'PRODUCTO' && id && (
            <div className="sm:col-span-2">
              <VariantesProductoPanel productoId={id} nombreProducto={valores.nombre} />
            </div>
          )}
          {valores.tipo === 'PRODUCTO' && !id && (
            <p className="text-xs text-slate-400 sm:col-span-2">Guardá el producto primero para poder armarle variantes (Talla, Color, etc.).</p>
          )}
        </CardColapsable>
      </form>

      {candidatosIa && (
        <Modal titulo="Elegí la opción que mejor describa el producto" onClose={() => setCandidatosIa(null)}>
          <div className="space-y-3">
            {candidatosIa.map((candidato, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setValores((v) => ({ ...v, nombre: candidato.nombre, descripcionTienda: candidato.descripcion }));
                  setCandidatosIa(null);
                }}
                className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-sol-500 hover:bg-sol-50 dark:border-slate-700 dark:hover:bg-sol-900/30"
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">{candidato.nombre}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{candidato.descripcion}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCandidatosIa(null)}
              className="w-full text-center text-sm text-slate-500 hover:underline dark:text-slate-400"
            >
              Ninguna de estas — cancelar
            </button>
          </div>
        </Modal>
      )}
    </PaginaDocumento>
  );
}
