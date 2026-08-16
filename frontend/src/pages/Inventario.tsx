import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { PaginaResultado } from '../types/pagina-resultado';

interface Bodega {
  id: string;
  nombre: string;
  direccion: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [bodegaSeleccionadaId, setBodegaSeleccionadaId] = useState<string | null>(null);
  const [modalNuevaBodega, setModalNuevaBodega] = useState(false);
  const [modalAjustar, setModalAjustar] = useState(false);
  const [modalTransferir, setModalTransferir] = useState(false);

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
    queryKey: ['stock', bodegaSeleccionadaId],
    enabled: !!bodegaSeleccionadaId,
    queryFn: async () => (await apiClient.get<Stock[]>(`/inventario/stock/${bodegaSeleccionadaId}`)).data,
  });

  const bodegaSeleccionada = bodegas?.find((b) => b.id === bodegaSeleccionadaId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Inventario</h1>
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
              <button
                key={bodega.id}
                onClick={() => setBodegaSeleccionadaId(bodega.id)}
                className={clsx(
                  'rounded-lg border p-4 text-left transition-colors',
                  bodega.id === bodegaSeleccionadaId
                    ? 'border-sol-500 bg-sol-50 dark:bg-sol-900/20'
                    : 'border-slate-200 bg-white hover:border-sol-300 dark:border-slate-800 dark:bg-slate-900',
                )}
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">{bodega.nombre}</p>
                {bodega.direccion && <p className="text-sm text-slate-500 dark:text-slate-400">{bodega.direccion}</p>}
              </button>
            ))}
          </div>
        )}

        {bodegaSeleccionada && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-slate-900 dark:text-slate-100">Stock — {bodegaSeleccionada.nombre}</h2>
              <div className="flex gap-2">
                <RequierePermiso permiso="inventario.ajustar">
                  <Button variante="secundario" onClick={() => setModalAjustar(true)}>
                    Ajustar stock
                  </Button>
                </RequierePermiso>
                <RequierePermiso permiso="inventario.transferir">
                  <Button variante="secundario" onClick={() => setModalTransferir(true)}>
                    Transferir stock
                  </Button>
                </RequierePermiso>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Producto</th>
                    <th className="px-4 py-2">Actual</th>
                    <th className="px-4 py-2">Reservada</th>
                    <th className="px-4 py-2">Disponible</th>
                    <th className="px-4 py-2">Mínimo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stock?.map((linea) => (
                    <tr key={linea.productoId}>
                      <td className="px-4 py-2">
                        {linea.producto.codigo} — {linea.producto.nombre}
                      </td>
                      <td className="px-4 py-2">{Number(linea.cantidadActual)}</td>
                      <td className="px-4 py-2">{Number(linea.cantidadReservada)}</td>
                      <td className="px-4 py-2">{Number(linea.cantidadActual) - Number(linea.cantidadReservada)}</td>
                      <td className="px-4 py-2">{Number(linea.stockMinimo)}</td>
                    </tr>
                  ))}
                  {stock?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        Esta bodega no tiene stock registrado todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </RequierePermiso>

      {modalNuevaBodega && <ModalNuevaBodega onClose={() => setModalNuevaBodega(false)} />}
      {modalAjustar && bodegaSeleccionadaId && (
        <ModalAjustarStock bodegaId={bodegaSeleccionadaId} onClose={() => setModalAjustar(false)} />
      )}
      {modalTransferir && bodegaSeleccionadaId && (
        <ModalTransferirStock
          bodegaOrigenId={bodegaSeleccionadaId}
          bodegas={bodegas ?? []}
          onClose={() => setModalTransferir(false)}
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

function ModalAjustarStock({ bodegaId, onClose }: { bodegaId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const ajustar = useMutation({
    mutationFn: async () =>
      apiClient.post('/inventario/ajustar', { productoId, bodegaId, cantidad: Number(cantidad), motivo }),
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
          <Select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {productos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </Select>
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
  onClose,
}: {
  bodegaOrigenId: string;
  bodegas: Bodega[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [productoId, setProductoId] = useState('');
  const [bodegaDestinoId, setBodegaDestinoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const transferir = useMutation({
    mutationFn: async () =>
      apiClient.post('/inventario/transferir', {
        productoId,
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
          <Select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {productos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </Select>
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
