import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { SelectCategoria } from '../components/molecules/SelectCategoria/SelectCategoria';
import { ImportarProductosModal } from '../components/organisms/ImportarProductosModal/ImportarProductosModal';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useListasPrecio } from '../hooks/useListasPrecio';
import { useVariantesProducto, etiquetaVariante } from '../hooks/useVariantesProducto';
import { descargarBlob } from '../lib/descargar-archivo';
import { PaginaResultado } from '../types/pagina-resultado';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import type { Producto, TipoProducto } from './ProductoFormulario';

export type { Producto, TipoProducto };

interface Precio {
  id: string;
  listaPrecio: string;
  costo: string;
  margenPct: string | null;
  precioVenta: string;
}

const ETIQUETA_TIPO: Record<TipoProducto, string> = { PRODUCTO: 'Producto', SERVICIO: 'Servicio', COMBO: 'Combo' };
const TONO_TIPO: Record<TipoProducto, 'neutro' | 'exito'> = { PRODUCTO: 'neutro', SERVICIO: 'exito', COMBO: 'exito' };

export function Productos() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [productoPrecio, setProductoPrecio] = useState<Producto | null>(null);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['productos', pagina, busquedaDebounced, categoriaId],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Producto>>('/productos', {
          params: { pagina, busqueda: busquedaDebounced || undefined, categoriaId: categoriaId || undefined },
        })
      ).data,
  });

  async function exportarExcel() {
    setExportando(true);
    try {
      const respuesta = await apiClient.get('/productos/exportar', { responseType: 'blob' });
      descargarBlob(respuesta.data, 'productos.xlsx');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Productos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Catálogo de productos, servicios y combos.</p>
        </div>
        <div className="flex gap-2">
          <Button variante="secundario" disabled={exportando} onClick={exportarExcel}>
            {exportando ? 'Generando…' : 'Exportar Excel'}
          </Button>
          <Button variante="secundario" onClick={() => setModalImportarAbierto(true)}>
            Importar Excel
          </Button>
          <Button onClick={() => navigate('/productos/nuevo')}>Nuevo producto</Button>
        </div>
      </div>

      <RequierePermiso permiso="precios.ver">
        <Card
          sinPadding
          titulo="Productos"
          descripcion={data ? `${data.total} producto(s)` : undefined}
          acciones={
            <div className="flex items-center gap-2">
              <div className="w-48">
                <SelectCategoria
                  value={categoriaId}
                  onChange={(v) => {
                    setCategoriaId(v);
                    setPagina(1);
                  }}
                />
              </div>
              <SearchInput
                value={busqueda}
                onChange={(v) => {
                  setBusqueda(v);
                  setPagina(1);
                }}
                placeholder="Buscar por código o nombre…"
              />
            </div>
          }
        >
          {data?.datos.length === 0 ? (
            <div className="p-5">
              <EstadoVacio
                titulo="Todavía no hay productos"
                descripcion="Creá el primero para poder facturarlo o comprarlo."
                etiquetaAccion="Nuevo producto"
                onAccion={() => navigate('/productos/nuevo')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Código</th>
                    <th className="px-5 py-3 font-medium">Nombre</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 font-medium">Categoría</th>
                    <th className="px-5 py-3 font-medium">Unidad</th>
                    <th className="px-5 py-3 font-medium">ITBIS %</th>
                    <th className="px-5 py-3 font-medium">Precio vigente</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.datos.map((producto) => (
                    <tr key={producto.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">{producto.codigo}</td>
                      <td className="px-5 py-3">{producto.nombre}</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_TIPO[producto.tipo]}>{ETIQUETA_TIPO[producto.tipo]}</Badge>
                      </td>
                      <td className="px-5 py-3">{producto.categoria?.nombre ?? '—'}</td>
                      <td className="px-5 py-3">{producto.unidadMedida}</td>
                      <td className="px-5 py-3">{Number(producto.porcentajeItbis)}%</td>
                      <td className="px-5 py-3">
                        <PrecioVigente productoId={producto.id} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActionsMenu
                          acciones={[
                            { etiqueta: 'Ver', onClick: () => navigate(`/productos/${producto.id}`) },
                            { etiqueta: 'Editar', onClick: () => navigate(`/productos/${producto.id}/editar`) },
                            { etiqueta: 'Cambiar precio', onClick: () => setProductoPrecio(producto) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && (
            <div className="px-5 py-3">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>
      </RequierePermiso>

      {productoPrecio && <ModalCambiarPrecio producto={productoPrecio} onClose={() => setProductoPrecio(null)} />}
      {modalImportarAbierto && (
        <Modal titulo="Importar productos" ancho="xl" onClose={() => setModalImportarAbierto(false)}>
          <ImportarProductosModal
            onImportado={() => {
              queryClient.invalidateQueries({ queryKey: ['productos'] });
              // Una fila importada puede traer precioGeneral — sin esto, la
              // columna "Precio vigente" de filas ya renderizadas se queda
              // con el valor viejo en caché hasta recargar la página (bug
              // real, encontrado en la verificación manual de esta fase).
              queryClient.invalidateQueries({ queryKey: ['precio-vigente'] });
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function PrecioVigente({ productoId }: { productoId: string }) {
  const { data: variantes } = useVariantesProducto(productoId);
  // Con más de una variante real, "el" precio vigente es ambiguo — cuál
  // corresponde depende de qué variante se elija (ver FormularioPrecio).
  const varias = (variantes?.length ?? 0) > 1;
  const { data } = useQuery({
    queryKey: ['precio-vigente', productoId],
    queryFn: async () => (await apiClient.get<Precio | null>(`/precios/${productoId}`)).data,
    enabled: !varias,
  });

  if (varias) return <span className="text-xs text-slate-400">Varias variantes</span>;
  if (!data) return <span className="text-slate-400">—</span>;
  return <span>RD$ {Number(data.precioVenta).toLocaleString('es-DO')}</span>;
}

/**
 * Cambiar precio de un producto con variantes reales (Fase 3c): antes era
 * un `<select>` metido dentro del mismo formulario — ahora, mismo criterio
 * que el selector de variante del POS (`CatalogoProductosPos`), primero
 * se elige la variante en una lista de botones (con su precio vigente
 * visible) y recién después se abre el formulario de precio para esa
 * variante puntual. Un producto sin atributos reales (una sola variante
 * "por defecto") se salta este paso — va directo al formulario, igual que
 * antes.
 */
function ModalCambiarPrecio({ producto, onClose }: { producto: Producto; onClose: () => void }) {
  const { data: variantes } = useVariantesProducto(producto.id);
  const [varianteId, setVarianteId] = useState<string | null>(null);

  useEffect(() => {
    if (variantes?.length === 1) setVarianteId(variantes[0].id);
  }, [variantes]);

  const varianteElegida = variantes?.find((v) => v.id === varianteId);
  const eligiendoVariante = !!variantes && variantes.length > 1 && !varianteId;

  const titulo = varianteElegida
    ? `Cambiar precio — ${producto.nombre} (${etiquetaVariante(varianteElegida) || 'sin atributos'})`
    : `Cambiar precio — ${producto.nombre}`;

  return (
    <Modal titulo={titulo} onClose={onClose}>
      {!variantes ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando variantes…</p>
      ) : eligiendoVariante ? (
        <div className="space-y-2">
          {variantes.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVarianteId(v.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-sol-400 hover:bg-sol-50/50 dark:border-slate-800 dark:hover:bg-sol-900/10"
            >
              <span>{etiquetaVariante(v) || '(sin atributos)'}</span>
              <PrecioVigenteVariante productoId={producto.id} varianteId={v.id} />
            </button>
          ))}
        </div>
      ) : (
        <FormularioPrecio
          productoId={producto.id}
          varianteId={varianteId ?? undefined}
          onVolver={variantes.length > 1 ? () => setVarianteId(null) : undefined}
          onGuardado={onClose}
        />
      )}
    </Modal>
  );
}

/** Precio vigente (nivel GENERAL) de una variante puntual — solo para mostrarlo junto a cada opción del selector de arriba, referencial nada más (FormularioPrecio deja elegir otro nivel de precio). */
function PrecioVigenteVariante({ productoId, varianteId }: { productoId: string; varianteId: string }) {
  const { data } = useQuery({
    queryKey: ['precio-vigente', productoId, varianteId, 'GENERAL'],
    queryFn: async () =>
      (await apiClient.get<Precio | null>(`/precios/${productoId}`, { params: { varianteId, listaPrecio: 'GENERAL' } })).data,
  });
  return (
    <span className="shrink-0 font-medium text-sol-600 dark:text-sol-400">
      {data ? `RD$ ${Number(data.precioVenta).toLocaleString('es-DO')}` : 'Sin precio'}
    </span>
  );
}

function FormularioPrecio({
  productoId,
  varianteId,
  onVolver,
  onGuardado,
}: {
  productoId: string;
  /** Ya resuelta por `ModalCambiarPrecio` — un producto de una sola variante manda la suya, sin que nadie tenga que elegir nada. */
  varianteId?: string;
  /** Solo cuando el producto tiene más de una variante — deja volver a la lista para cambiarle el precio a otra. */
  onVolver?: () => void;
  onGuardado: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: listasPrecio } = useListasPrecio();
  const [listaPrecio, setListaPrecio] = useState('GENERAL');
  const { data: vigente } = useQuery({
    queryKey: ['precio-vigente', productoId, varianteId, listaPrecio],
    enabled: !!varianteId,
    queryFn: async () =>
      (
        await apiClient.get<Precio | null>(`/precios/${productoId}`, {
          params: { varianteId, listaPrecio },
        })
      ).data,
  });
  const [costo, setCosto] = useState('');
  const [margenPct, setMargenPct] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.post('/precios', {
        productoId,
        varianteId,
        listaPrecio,
        costo: Number(costo),
        margenPct: margenPct ? Number(margenPct) : undefined,
        precioVenta: precioVenta ? Number(precioVenta) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precio-vigente', productoId] });
      onGuardado();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el precio. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!margenPct && !precioVenta) {
      setError('Indicá el margen % o el precio de venta.');
      return;
    }
    guardar.mutate();
  }

  function calcularPrecio() {
    const c = Number(costo);
    const m = Number(margenPct);
    if (!costo || isNaN(c) || c <= 0) {
      setError('Indicá un costo válido para calcular el precio.');
      return;
    }
    if (!margenPct || isNaN(m)) {
      setError('Indicá un margen % válido para calcular el precio.');
      return;
    }
    setError(null);
    setPrecioVenta((c * (1 + m / 100)).toFixed(2));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {onVolver && (
        <button type="button" onClick={onVolver} className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
          ← Elegir otra variante
        </button>
      )}
      {vigente && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Precio vigente: RD$ {Number(vigente.precioVenta).toLocaleString('es-DO')} (costo RD${' '}
          {Number(vigente.costo).toLocaleString('es-DO')})
        </p>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Cambiar el precio no edita el anterior: cierra el vigente y crea uno nuevo, para conservar el historial.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="precio-lista" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Nivel de precio
        </label>
        <Select id="precio-lista" value={listaPrecio} onChange={(e) => setListaPrecio(e.target.value)}>
          {listasPrecio?.map((lista) => (
            <option key={lista.id} value={lista.nombre}>
              {lista.nombre}
            </option>
          ))}
        </Select>
      </div>
      <FormField id="precio-costo" label="Costo" type="number" min={0} step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} required />
      <FormField
        id="precio-margen"
        label="Margen % (opcional si indicás precio de venta)"
        type="number"
        min={0}
        step="0.01"
        value={margenPct}
        onChange={(e) => setMargenPct(e.target.value)}
      />
      <Button type="button" variante="secundario" onClick={calcularPrecio} className="w-full">
        Calcular precio de venta
      </Button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Calcula el precio a partir de costo + margen y lo deja abajo para revisar — podés guardarlo tal cual o
        cambiarlo a mano. Si después editás costo o margen, el precio no se recalcula solo: hay que volver a tocar
        "Calcular".
      </p>
      <FormField
        id="precio-venta"
        label="Precio de venta (opcional si indicás margen %)"
        type="number"
        min={0}
        step="0.01"
        value={precioVenta}
        onChange={(e) => setPrecioVenta(e.target.value)}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar precio'}
      </Button>
    </form>
  );
}
