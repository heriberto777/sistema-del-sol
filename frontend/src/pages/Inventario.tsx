import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { useAuth } from '../hooks/useAuth';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import { FORMATOS_IMPRESION, FormatoImpresion } from '../constants/formato-impresion';

interface Bodega {
  id: string;
  nombre: string;
  direccion: string | null;
  formatoImpresion: FormatoImpresion | null;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
}

interface Stock {
  productoId: string;
  cantidadActual: string;
  cantidadReservada: string;
  stockMinimo: string;
  producto: Producto;
}

export function Inventario() {
  const { tienePermiso } = useAuth();
  const tienePermisoAjustar = tienePermiso('inventario.ajustar');
  const tienePermisoTransferir = tienePermiso('inventario.transferir');
  const [searchParams, setSearchParams] = useSearchParams();
  const [bodegaSeleccionadaId, setBodegaSeleccionadaId] = useState<string | null>(null);
  const [modalNuevaBodega, setModalNuevaBodega] = useState(false);
  const [productoAjustando, setProductoAjustando] = useState<Producto | null>(null);
  const [productoTransfiriendo, setProductoTransfiriendo] = useState<Producto | null>(null);
  const [bodegaEditandoFormato, setBodegaEditandoFormato] = useState<Bodega | null>(null);
  const [busquedaStock, setBusquedaStock] = useState('');
  const [paginaStock, setPaginaStock] = useState(1);
  const busquedaStockDebounced = useDebouncedValue(busquedaStock);

  useEffect(() => {
    if (searchParams.get('crear') === '1') {
      setModalNuevaBodega(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const { data: stock } = useQuery({
    queryKey: ['stock', bodegaSeleccionadaId, paginaStock, busquedaStockDebounced],
    enabled: !!bodegaSeleccionadaId,
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Stock>>(`/inventario/stock/${bodegaSeleccionadaId}`, {
          params: { pagina: paginaStock, busqueda: busquedaStockDebounced || undefined },
        })
      ).data,
  });

  const bodegaSeleccionada = bodegas?.find((b) => b.id === bodegaSeleccionadaId) ?? null;

  function seleccionarBodega(id: string) {
    setBodegaSeleccionadaId(id);
    setPaginaStock(1);
    setBusquedaStock('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventario</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bodegas y existencias por producto.</p>
        </div>
        <RequierePermiso permiso="admin.configuracion">
          <Button onClick={() => setModalNuevaBodega(true)}>Nueva bodega</Button>
        </RequierePermiso>
      </div>

      <RequierePermiso permiso="inventario.ver">
        {bodegas?.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay bodegas"
            descripcion="Creá la primera para empezar a llevar control de tu stock."
            etiquetaAccion="Nueva bodega"
            onAccion={() => setModalNuevaBodega(true)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bodegas?.map((bodega) => (
              <div
                key={bodega.id}
                role="button"
                tabIndex={0}
                onClick={() => seleccionarBodega(bodega.id)}
                onKeyDown={(e) => e.key === 'Enter' && seleccionarBodega(bodega.id)}
                className={clsx(
                  'rounded-lg border p-4 text-left transition-colors',
                  bodega.id === bodegaSeleccionadaId
                    ? 'border-sol-500 bg-sol-50 dark:bg-sol-900/20'
                    : 'border-slate-200 bg-white hover:border-sol-300 dark:border-slate-800 dark:bg-slate-900',
                )}
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">{bodega.nombre}</p>
                {bodega.direccion && <p className="text-sm text-slate-500 dark:text-slate-400">{bodega.direccion}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    {FORMATOS_IMPRESION.find((f) => f.value === bodega.formatoImpresion)?.label ?? 'Formato de la empresa'}
                  </p>
                  <RequierePermiso permiso="admin.configuracion">
                    <button
                      type="button"
                      className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBodegaEditandoFormato(bodega);
                      }}
                    >
                      Editar formato
                    </button>
                  </RequierePermiso>
                </div>
              </div>
            ))}
          </div>
        )}

        {bodegaSeleccionada && (
          <Card
            sinPadding
            titulo={`Stock — ${bodegaSeleccionada.nombre}`}
            descripcion={stock ? `${stock.total} producto(s) en esta bodega` : undefined}
            acciones={
              <SearchInput
                value={busquedaStock}
                onChange={(v) => {
                  setBusquedaStock(v);
                  setPaginaStock(1);
                }}
                placeholder="Buscar por código o nombre de producto…"
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Producto</th>
                    <th className="px-5 py-3 font-medium">Actual</th>
                    <th className="px-5 py-3 font-medium">Reservada</th>
                    <th className="px-5 py-3 font-medium">Disponible</th>
                    <th className="px-5 py-3 font-medium">Mínimo</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stock?.datos.map((linea) => (
                    <tr key={linea.productoId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        {linea.producto.codigo} — {linea.producto.nombre}
                      </td>
                      <td className="px-5 py-3">{Number(linea.cantidadActual)}</td>
                      <td className="px-5 py-3">{Number(linea.cantidadReservada)}</td>
                      <td className="px-5 py-3">{Number(linea.cantidadActual) - Number(linea.cantidadReservada)}</td>
                      <td className="px-5 py-3">{Number(linea.stockMinimo)}</td>
                      <td className="px-5 py-3 text-right">
                        <RowActionsMenu
                          acciones={[
                            ...(tienePermisoAjustar
                              ? [{ etiqueta: 'Ajustar stock', onClick: () => setProductoAjustando(linea.producto) }]
                              : []),
                            ...(tienePermisoTransferir
                              ? [{ etiqueta: 'Transferir stock', onClick: () => setProductoTransfiriendo(linea.producto) }]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                  {stock?.datos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                        Esta bodega no tiene stock registrado todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {stock && (
              <div className="px-5 py-3">
                <Paginacion pagina={stock.pagina} tamanoPagina={stock.tamanoPagina} total={stock.total} onCambiarPagina={setPaginaStock} />
              </div>
            )}
          </Card>
        )}
      </RequierePermiso>

      {modalNuevaBodega && <ModalNuevaBodega onClose={() => setModalNuevaBodega(false)} />}
      {bodegaEditandoFormato && (
        <ModalEditarFormatoBodega bodega={bodegaEditandoFormato} onClose={() => setBodegaEditandoFormato(null)} />
      )}
      {productoAjustando && bodegaSeleccionadaId && (
        <ModalAjustarStock
          bodegaId={bodegaSeleccionadaId}
          productoInicial={productoAjustando}
          onClose={() => setProductoAjustando(null)}
        />
      )}
      {productoTransfiriendo && bodegaSeleccionadaId && (
        <ModalTransferirStock
          bodegaOrigenId={bodegaSeleccionadaId}
          bodegas={bodegas ?? []}
          productoInicial={productoTransfiriendo}
          onClose={() => setProductoTransfiriendo(null)}
        />
      )}
    </div>
  );
}

function ModalNuevaBodega({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/inventario/bodegas', { nombre, direccion: direccion || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
      onClose();
    },
    onError: () => setError('No se pudo crear la bodega.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva bodega" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="bodega-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <FormField id="bodega-direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear bodega'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalEditarFormatoBodega({ bodega, onClose }: { bodega: Bodega; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formatoImpresion, setFormatoImpresion] = useState(bodega.formatoImpresion ?? '');

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/inventario/bodegas/${bodega.id}`, { formatoImpresion: formatoImpresion || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
      onClose();
    },
  });

  return (
    <Modal titulo={`Formato de impresión — ${bodega.nombre}`} onClose={onClose}>
      <div className="space-y-3">
        <Select value={formatoImpresion} onChange={(e) => setFormatoImpresion(e.target.value)}>
          <option value="">Usar el default de la empresa</option>
          {FORMATOS_IMPRESION.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  );
}

function ModalAjustarStock({
  bodegaId,
  productoInicial,
  onClose,
}: {
  bodegaId: string;
  productoInicial: Producto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ajustar = useMutation({
    mutationFn: async () =>
      apiClient.post('/inventario/ajustar', { productoId: productoInicial.id, bodegaId, cantidad: Number(cantidad), motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', bodegaId] });
      onClose();
    },
    onError: () => setError('No se pudo ajustar el stock. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    ajustar.mutate();
  }

  return (
    <Modal titulo="Ajustar stock" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {productoInicial.codigo} — {productoInicial.nombre}
          </p>
        </div>
        <FormField
          id="ajuste-cantidad"
          label="Cantidad (negativo para restar)"
          type="number"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          required
        />
        <FormField id="ajuste-motivo" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={ajustar.isPending} className="w-full">
          {ajustar.isPending ? 'Ajustando…' : 'Ajustar'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalTransferirStock({
  bodegaOrigenId,
  bodegas,
  productoInicial,
  onClose,
}: {
  bodegaOrigenId: string;
  bodegas: Bodega[];
  productoInicial: Producto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [bodegaDestinoId, setBodegaDestinoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState<string | null>(null);

  const transferir = useMutation({
    mutationFn: async () =>
      apiClient.post('/inventario/transferir', {
        productoId: productoInicial.id,
        bodegaOrigenId,
        bodegaDestinoId,
        cantidad: Number(cantidad),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', bodegaOrigenId] });
      queryClient.invalidateQueries({ queryKey: ['stock', bodegaDestinoId] });
      onClose();
    },
    onError: () => setError('No se pudo transferir el stock. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    transferir.mutate();
  }

  return (
    <Modal titulo="Transferir stock" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Producto</label>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {productoInicial.codigo} — {productoInicial.nombre}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega destino</label>
          <Select value={bodegaDestinoId} onChange={(e) => setBodegaDestinoId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bodegas.filter((b) => b.id !== bodegaOrigenId).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </div>
        <FormField id="transferir-cantidad" label="Cantidad" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={transferir.isPending} className="w-full">
          {transferir.isPending ? 'Transfiriendo…' : 'Transferir'}
        </Button>
      </form>
    </Modal>
  );
}
