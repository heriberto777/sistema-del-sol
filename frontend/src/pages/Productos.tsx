import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  unidadMedida: string;
  porcentajeItbis: string;
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
  categoria: string;
  unidadMedida: string;
  porcentajeItbis: string;
}

const PRODUCTO_VACIO: ProductoFormValues = { codigo: '', nombre: '', categoria: '', unidadMedida: 'UND', porcentajeItbis: '18' };

export function Productos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
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
    queryKey: ['productos', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Producto>>('/productos', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Productos</h1>
        <Button onClick={abrirNuevo}>Nuevo producto</Button>
      </div>

      <RequierePermiso permiso="precios.ver">
        <SearchInput
          value={busqueda}
          onChange={(v) => {
            setBusqueda(v);
            setPagina(1);
          }}
          placeholder="Buscar por código o nombre…"
        />
        {data?.datos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay productos"
            descripcion="Creá el primero para poder facturarlo o comprarlo."
            etiquetaAccion="Nuevo producto"
            onAccion={abrirNuevo}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Categoría</th>
                  <th className="px-4 py-2">Unidad</th>
                  <th className="px-4 py-2">ITBIS %</th>
                  <th className="px-4 py-2">Precio vigente</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.datos.map((producto) => (
                  <tr key={producto.id}>
                    <td className="px-4 py-2">{producto.codigo}</td>
                    <td className="px-4 py-2">{producto.nombre}</td>
                    <td className="px-4 py-2">{producto.categoria ?? '—'}</td>
                    <td className="px-4 py-2">{producto.unidadMedida}</td>
                    <td className="px-4 py-2">{Number(producto.porcentajeItbis)}%</td>
                    <td className="px-4 py-2">
                      <PrecioVigente productoId={producto.id} />
                    </td>
                    <td className="px-4 py-2 text-right">
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
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        )}
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
          categoria: producto.categoria ?? '',
          unidadMedida: producto.unidadMedida,
          porcentajeItbis: producto.porcentajeItbis,
        }
      : PRODUCTO_VACIO,
  );
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      codigo: valores.codigo,
      nombre: valores.nombre,
      categoria: valores.categoria || undefined,
      unidadMedida: valores.unidadMedida || undefined,
      porcentajeItbis: valores.porcentajeItbis ? Number(valores.porcentajeItbis) : undefined,
    };
  }

  const guardar = useMutation({
    mutationFn: async () =>
      producto ? apiClient.patch(`/productos/${producto.id}`, payload()) : apiClient.post('/productos', payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
      onGuardado();
    },
    onError: () => setError('No se pudo guardar el producto. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
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
      <FormField
        id="producto-categoria"
        label="Categoría"
        value={valores.categoria}
        onChange={(e) => setValores((v) => ({ ...v, categoria: e.target.value }))}
      />
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
