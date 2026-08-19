import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { CampoImagen } from '../components/molecules/CampoImagen/CampoImagen';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { SelectCategoria } from '../components/molecules/SelectCategoria/SelectCategoria';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

type TipoProducto = 'PRODUCTO' | 'SERVICIO' | 'COMBO';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  categoriaId: string | null;
  categoria: { id: string; nombre: string } | null;
  unidadMedida: string;
  porcentajeItbis: string;
  tipo: TipoProducto;
}

interface ComponenteComboDetalle {
  cantidad: string;
  componente: { id: string; codigo: string; nombre: string };
}

interface ProductoDetalle extends Producto {
  componentes: ComponenteComboDetalle[];
  imagen: string | null;
}

interface Precio {
  id: string;
  listaPrecio: string;
  costo: string;
  margenPct: string | null;
  precioVenta: string;
}

interface ProductoFormValues {
  codigo: string;
  nombre: string;
  categoriaId: string;
  unidadMedida: string;
  porcentajeItbis: string;
  tipo: TipoProducto;
  imagen: string | null;
}

interface ComponenteComboForm {
  productoId: string;
  cantidad: string;
}

const PRODUCTO_VACIO: ProductoFormValues = {
  codigo: '',
  nombre: '',
  categoriaId: '',
  unidadMedida: 'UND',
  porcentajeItbis: '18',
  tipo: 'PRODUCTO',
  imagen: null,
};

const ETIQUETA_TIPO: Record<TipoProducto, string> = { PRODUCTO: 'Producto', SERVICIO: 'Servicio', COMBO: 'Combo' };
const TONO_TIPO: Record<TipoProducto, 'neutro' | 'exito'> = { PRODUCTO: 'neutro', SERVICIO: 'exito', COMBO: 'exito' };

export function Productos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [modalProductoAbierto, setModalProductoAbierto] = useState(false);
  const [productoPrecio, setProductoPrecio] = useState<Producto | null>(null);

  useEffect(() => {
    if (searchParams.get('crear') === '1') {
      setProductoEditando(null);
      setModalProductoAbierto(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data } = useQuery({
    queryKey: ['productos', pagina, busquedaDebounced, categoriaId],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Producto>>('/productos', {
          params: { pagina, busqueda: busquedaDebounced || undefined, categoriaId: categoriaId || undefined },
        })
      ).data,
  });

  function abrirNuevo() {
    setProductoEditando(null);
    setModalProductoAbierto(true);
  }

  function abrirEditar(p: Producto) {
    setProductoEditando(p);
    setModalProductoAbierto(true);
  }

  function cerrarModalProducto() {
    setModalProductoAbierto(false);
    setProductoEditando(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Productos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Catálogo de productos, servicios y combos.</p>
        </div>
        <Button onClick={abrirNuevo}>Nuevo producto</Button>
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
                onAccion={abrirNuevo}
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
                            { etiqueta: 'Cambiar precio', onClick: () => setProductoPrecio(producto) },
                            { etiqueta: 'Editar', onClick: () => abrirEditar(producto) },
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

      {modalProductoAbierto && (
        <Modal titulo={productoEditando ? 'Editar producto' : 'Nuevo producto'} onClose={cerrarModalProducto}>
          <FormularioProducto producto={productoEditando} onGuardado={cerrarModalProducto} />
        </Modal>
      )}
      {productoPrecio && (
        <Modal titulo={`Cambiar precio — ${productoPrecio.nombre}`} onClose={() => setProductoPrecio(null)}>
          <FormularioPrecio productoId={productoPrecio.id} onGuardado={() => setProductoPrecio(null)} />
        </Modal>
      )}
    </div>
  );
}

function PrecioVigente({ productoId }: { productoId: string }) {
  const { data } = useQuery({
    queryKey: ['precio-vigente', productoId],
    queryFn: async () => (await apiClient.get<Precio | null>(`/precios/${productoId}`)).data,
  });

  if (!data) return <span className="text-slate-400">—</span>;
  return <span>RD$ {Number(data.precioVenta).toLocaleString('es-DO')}</span>;
}

function FormularioProducto({ producto, onGuardado }: { producto: Producto | null; onGuardado: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<ProductoFormValues>(
    producto
      ? {
          codigo: producto.codigo,
          nombre: producto.nombre,
          categoriaId: producto.categoriaId ?? '',
          unidadMedida: producto.unidadMedida,
          porcentajeItbis: producto.porcentajeItbis,
          tipo: producto.tipo,
          imagen: null,
        }
      : PRODUCTO_VACIO,
  );
  const [componentes, setComponentes] = useState<ComponenteComboForm[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Editar un producto existente: la lista (GET /productos) no trae ni la
  // imagen ni (si es combo) los componentes — hay que pedir el detalle
  // completo para precargarlos.
  useEffect(() => {
    if (!producto) return;
    apiClient.get<ProductoDetalle>(`/productos/${producto.id}`).then(({ data }) => {
      setValores((v) => ({ ...v, imagen: data.imagen }));
      if (data.tipo === 'COMBO') {
        setComponentes(data.componentes.map((c) => ({ productoId: c.componente.id, cantidad: c.cantidad })));
      }
    });
  }, [producto]);

  const { data: productosDisponibles } = useQuery({
    queryKey: ['productos-select-combo'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 200 } })).data.datos,
    enabled: valores.tipo === 'COMBO',
  });
  // Un combo no puede componerse de otro combo ni de sí mismo.
  const opcionesComponente = (productosDisponibles ?? []).filter((p) => p.tipo !== 'COMBO' && p.id !== producto?.id);

  function actualizarComponente(i: number, cambios: Partial<ComponenteComboForm>) {
    setComponentes((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...cambios } : c)));
  }

  function payload() {
    return {
      codigo: valores.codigo,
      nombre: valores.nombre,
      categoriaId: valores.categoriaId || null,
      unidadMedida: valores.unidadMedida || undefined,
      porcentajeItbis: valores.porcentajeItbis ? Number(valores.porcentajeItbis) : undefined,
      tipo: valores.tipo,
      imagen: valores.imagen,
      componentes:
        valores.tipo === 'COMBO'
          ? componentes.filter((c) => c.productoId).map((c) => ({ productoId: c.productoId, cantidad: Number(c.cantidad) || 1 }))
          : undefined,
    };
  }

  const guardar = useMutation({
    mutationFn: async () =>
      producto ? apiClient.patch(`/productos/${producto.id}`, payload()) : apiClient.post('/productos', payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      onGuardado();
    },
    onError: () => setError('No se pudo guardar el producto. Revisa los datos (un combo necesita al menos un componente, y no puede incluirse a sí mismo ni a otro combo).'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (valores.tipo === 'COMBO' && componentes.filter((c) => c.productoId).length === 0) {
      setError('Un combo necesita al menos un componente.');
      return;
    }
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <CampoImagen valor={valores.imagen} onChange={(imagen) => setValores((v) => ({ ...v, imagen }))} />
      <div className="flex flex-col gap-1">
        <label htmlFor="producto-tipo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Tipo
        </label>
        <Select
          id="producto-tipo"
          value={valores.tipo}
          onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoProducto }))}
        >
          <option value="PRODUCTO">Producto (mueve inventario)</option>
          <option value="SERVICIO">Servicio (no mueve inventario)</option>
          <option value="COMBO">Combo (bundle de otros productos)</option>
        </Select>
      </div>
      <FormField
        id="producto-codigo"
        label="Código"
        value={valores.codigo}
        onChange={(e) => setValores((v) => ({ ...v, codigo: e.target.value }))}
        required
      />
      <FormField
        id="producto-nombre"
        label="Nombre"
        value={valores.nombre}
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
          onChange={(id) => setValores((v) => ({ ...v, categoriaId: id }))}
        />
      </div>
      <FormField
        id="producto-unidad"
        label="Unidad de medida"
        value={valores.unidadMedida}
        onChange={(e) => setValores((v) => ({ ...v, unidadMedida: e.target.value }))}
      />
      <FormField
        id="producto-itbis"
        label="ITBIS %"
        type="number"
        min={0}
        max={100}
        value={valores.porcentajeItbis}
        onChange={(e) => setValores((v) => ({ ...v, porcentajeItbis: e.target.value }))}
      />

      {valores.tipo === 'COMBO' && (
        <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Componentes (se descuentan del inventario al facturar el combo)
          </p>
          {componentes.map((componente, i) => (
            <div key={i} className="flex gap-2">
              <Select
                value={componente.productoId}
                onChange={(e) => actualizarComponente(i, { productoId: e.target.value })}
                required
                className="flex-1"
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
                onChange={(e) => actualizarComponente(i, { cantidad: e.target.value })}
                className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setComponentes((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-red-600 hover:text-red-700"
                aria-label="Quitar componente"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setComponentes((prev) => [...prev, { productoId: '', cantidad: '1' }])}
            className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Agregar componente
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}

function FormularioPrecio({ productoId, onGuardado }: { productoId: string; onGuardado: () => void }) {
  const queryClient = useQueryClient();
  const { data: vigente } = useQuery({
    queryKey: ['precio-vigente', productoId],
    queryFn: async () => (await apiClient.get<Precio | null>(`/precios/${productoId}`)).data,
  });
  const [costo, setCosto] = useState('');
  const [margenPct, setMargenPct] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.post('/precios', {
        productoId,
        costo: Number(costo),
        margenPct: margenPct ? Number(margenPct) : undefined,
        precioVenta: precioVenta ? Number(precioVenta) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precio-vigente', productoId] });
      onGuardado();
    },
    onError: () => setError('No se pudo guardar el precio. Revisa los datos.'),
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

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {vigente && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Precio vigente: RD$ {Number(vigente.precioVenta).toLocaleString('es-DO')} (costo RD${' '}
          {Number(vigente.costo).toLocaleString('es-DO')})
        </p>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Cambiar el precio no edita el anterior: cierra el vigente y crea uno nuevo, para conservar el historial.
      </p>
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
      <FormField
        id="precio-venta"
        label="Precio de venta (opcional si indicás margen %)"
        type="number"
        min={0}
        step="0.01"
        value={precioVenta}
        onChange={(e) => setPrecioVenta(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar precio'}
      </Button>
    </form>
  );
}
