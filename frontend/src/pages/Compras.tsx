import { FormEvent, useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { ModalRegistrarPagoOrdenCompra } from '../components/molecules/ModalRegistrarPagoOrdenCompra/ModalRegistrarPagoOrdenCompra';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface OrdenCompra {
  id: string;
  numero: string;
  estado: string;
  total: string;
  pagada: boolean;
  proveedor: { nombre: string };
}

interface Proveedor {
  id: string;
  nombre: string;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  controlaVencimiento: boolean;
}


interface LineaOcDetalle {
  productoId: string;
  varianteId: string;
  cantidad: string;
  cantidadRecibida: string;
  costoUnitario: string;
  producto: Producto;
}

interface Lote {
  id: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidadActual: string;
}

interface RecepcionDetalle {
  id: string;
  fecha: string;
  facturaProveedorNumero: string | null;
  montoFacturaProveedor: string | null;
}

interface OrdenCompraDetalle {
  id: string;
  numero: string;
  estado: string;
  fecha: string;
  total: string;
  lineas: LineaOcDetalle[];
  recepciones: RecepcionDetalle[];
}

// 'PENDIENTE' no existe en el enum EstadoOrdenCompra del backend (BORRADOR/
// ENVIADA/RECIBIDA_PARCIAL/RECIBIDA_TOTAL/CANCELADA) — sin este fix ninguna
// orden recién creada (siempre arranca en BORRADOR) podía recibirse nunca
// desde la UI (bug real preexistente, encontrado al verificar Fase 5b).
const ESTADOS_RECIBIBLES = ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL'];
const ESTADOS_CON_MERCANCIA_RECIBIDA = ['RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL'];
// Ítem E-1 — activa el flujo Borrador→Confirmado que el enum ya sugería:
// Editar/Confirmar solo tienen sentido en BORRADOR; Cancelar se bloquea en
// el backend si ya hay mercancía recibida (ahí corresponde "Devolver a
// proveedor" en su lugar), así que acá alcanza con excluir los 3 estados
// terminales/ya-recibidos.
const ESTADOS_CANCELABLES = ['BORRADOR', 'ENVIADA'];

export function Compras() {
  const { tienePermiso } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalNuevaOc, setModalNuevaOc] = useState(false);
  const [ordenRecibiendo, setOrdenRecibiendo] = useState<OrdenCompra | null>(null);
  const [ordenPagando, setOrdenPagando] = useState<OrdenCompra | null>(null);
  const [ordenDevolviendo, setOrdenDevolviendo] = useState<OrdenCompra | null>(null);
  const [ordenViendo, setOrdenViendo] = useState<OrdenCompra | null>(null);
  const [ordenEditando, setOrdenEditando] = useState<OrdenCompra | null>(null);
  const queryClient = useQueryClient();

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'ENVIADA' | 'CANCELADA' }) =>
      apiClient.patch(`/compras/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] }),
  });

  useEffect(() => {
    if (searchParams.get('crear') === '1') {
      setModalNuevaOc(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data } = useQuery({
    queryKey: ['ordenes-compra', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<OrdenCompra>>('/compras', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Compras</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Órdenes de compra a tus proveedores.</p>
        </div>
        <RequierePermiso permiso="compras.crear">
          <Button onClick={() => setModalNuevaOc(true)}>Nueva orden de compra</Button>
        </RequierePermiso>
      </div>
      <RequierePermiso permiso="compras.ver">
        <Card
          sinPadding
          titulo="Órdenes de compra"
          descripcion={data ? `${data.total} orden(es)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por número o proveedor…"
            />
          }
        >
          {data?.datos.length === 0 ? (
            <div className="p-5">
              <EstadoVacio
                titulo="Todavía no hay órdenes de compra"
                descripcion="Creá la primera para empezar a recibir mercancía de tus proveedores."
                etiquetaAccion="Nueva orden de compra"
                onAccion={() => setModalNuevaOc(true)}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Número</th>
                    <th className="px-5 py-3 font-medium">Proveedor</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.datos.map((oc) => {
                    const acciones = [
                      { etiqueta: 'Ver detalle', onClick: () => setOrdenViendo(oc) },
                      ...(oc.estado === 'BORRADOR' && tienePermiso('compras.editar')
                        ? [{ etiqueta: 'Editar', onClick: () => setOrdenEditando(oc) }]
                        : []),
                      ...(oc.estado === 'BORRADOR' && tienePermiso('compras.editar')
                        ? [{ etiqueta: 'Confirmar', onClick: () => cambiarEstado.mutate({ id: oc.id, estado: 'ENVIADA' }) }]
                        : []),
                      ...(ESTADOS_RECIBIBLES.includes(oc.estado) && tienePermiso('compras.recibir')
                        ? [{ etiqueta: 'Recibir', onClick: () => setOrdenRecibiendo(oc) }]
                        : []),
                      ...(oc.estado !== 'CANCELADA' && !oc.pagada && tienePermiso('compras.pagar')
                        ? [{ etiqueta: 'Registrar pago', onClick: () => setOrdenPagando(oc) }]
                        : []),
                      ...(ESTADOS_CON_MERCANCIA_RECIBIDA.includes(oc.estado) && tienePermiso('compras.recibir')
                        ? [{ etiqueta: 'Devolver a proveedor', onClick: () => setOrdenDevolviendo(oc) }]
                        : []),
                      ...(ESTADOS_CANCELABLES.includes(oc.estado) && tienePermiso('compras.editar')
                        ? [
                            {
                              etiqueta: 'Cancelar',
                              tono: 'peligro' as const,
                              onClick: () => {
                                if (confirm(`¿Cancelar la orden ${oc.numero}?`)) cambiarEstado.mutate({ id: oc.id, estado: 'CANCELADA' });
                              },
                            },
                          ]
                        : []),
                    ];

                    return (
                      <tr key={oc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3">{oc.numero}</td>
                        <td className="px-5 py-3">{oc.proveedor?.nombre}</td>
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(oc.total).toLocaleString('es-DO')}</td>
                        <td className="px-5 py-3">
                          <Badge>{oc.estado}</Badge>
                          <span className="ml-2 text-xs text-slate-400">{oc.pagada ? 'pagada' : 'pendiente de pago'}</span>
                        </td>
                        <td className="px-5 py-3 text-right">{acciones.length > 0 && <RowActionsMenu acciones={acciones} />}</td>
                      </tr>
                    );
                  })}
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

      {modalNuevaOc && <ModalNuevaOrdenCompra onClose={() => setModalNuevaOc(false)} />}
      {ordenEditando && <ModalEditarOrdenCompra orden={ordenEditando} onClose={() => setOrdenEditando(null)} />}
      {ordenRecibiendo && (
        <ModalRecibirOrden orden={ordenRecibiendo} onClose={() => setOrdenRecibiendo(null)} />
      )}
      {ordenPagando && <ModalRegistrarPagoOrdenCompra orden={ordenPagando} onClose={() => setOrdenPagando(null)} />}
      {ordenDevolviendo && <ModalDevolverOrden orden={ordenDevolviendo} onClose={() => setOrdenDevolviendo(null)} />}
      {ordenViendo && <ModalVerOrden orden={ordenViendo} onClose={() => setOrdenViendo(null)} />}
    </div>
  );
}

function ModalVerOrden({ orden, onClose }: { orden: OrdenCompra; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['orden-compra', orden.id],
    queryFn: async () => (await apiClient.get<OrdenCompraDetalle>(`/compras/${orden.id}`)).data,
  });

  return (
    <Modal titulo={`Orden de compra — ${orden.numero}`} onClose={onClose}>
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <p>
              Proveedor: <span className="font-medium">{orden.proveedor?.nombre}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Fecha: {new Date(data.fecha).toLocaleDateString('es-DO')} — Estado: <Badge>{data.estado}</Badge>
            </p>
            <p className="font-medium">Total: RD$ {Number(data.total).toLocaleString('es-DO')}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Pedido</th>
                    <th className="px-3 py-2">Recibido</th>
                    <th className="px-3 py-2">Costo unit.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.lineas.map((linea) => (
                    <tr key={linea.productoId}>
                      <td className="px-3 py-2">
                        {linea.producto.codigo} — {linea.producto.nombre}
                      </td>
                      <td className="px-3 py-2">{Number(linea.cantidad)}</td>
                      <td className="px-3 py-2">{Number(linea.cantidadRecibida)}</td>
                      <td className="px-3 py-2">RD$ {Number(linea.costoUnitario).toLocaleString('es-DO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.recepciones.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Recepciones</p>
              <div className="space-y-1">
                {data.recepciones.map((r) => (
                  <p key={r.id} className="text-sm text-slate-600 dark:text-slate-400">
                    {new Date(r.fecha).toLocaleDateString('es-DO')}
                    {r.facturaProveedorNumero && ` — Factura del proveedor: ${r.facturaProveedorNumero}`}
                    {r.montoFacturaProveedor && ` (RD$ ${Number(r.montoFacturaProveedor).toLocaleString('es-DO')})`}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ModalNuevaOrdenCompra({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [lineas, setLineas] = useState([{ productoId: '', varianteId: '', cantidad: '1', costoUnitario: '' }]);
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const total = lineas.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.costoUnitario || 0), 0);

  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/compras', {
        proveedorId: proveedor?.id,
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId || undefined,
            cantidad: Number(l.cantidad),
            costoUnitario: Number(l.costoUnitario),
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la orden de compra. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!proveedor) {
      setError('Seleccioná un proveedor.');
      return;
    }
    if (lineas.filter((l) => l.productoId).length === 0) {
      setError('Agregá al menos una línea con producto.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva orden de compra" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Proveedor</label>
          <ComboboxBusqueda<Proveedor>
            valor={proveedor}
            onSeleccionar={setProveedor}
            obtenerId={(p) => p.id}
            obtenerEtiqueta={(p) => p.nombre}
            placeholder="Buscar proveedor…"
            icono={<Truck size={15} />}
            buscar={async (texto) =>
              (await apiClient.get<PaginaResultado<Proveedor>>('/proveedores', { params: { busqueda: texto, tamanoPagina: 10 } })).data
                .datos
            }
          />
          <button
            type="button"
            onClick={() => setMostrarNuevoProveedor((v) => !v)}
            className="self-start text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Nuevo proveedor
          </button>
          {mostrarNuevoProveedor && (
            <NuevoProveedorInline
              onCreado={(p) => {
                setProveedor(p);
                setMostrarNuevoProveedor(false);
              }}
            />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex gap-2">
              <SelectorLineaProducto
                productos={productos ?? []}
                productoId={linea.productoId}
                varianteId={linea.varianteId}
                onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Costo"
                value={linea.costoUnitario}
                onChange={(e) => actualizarLinea(i, { costoUnitario: e.target.value })}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {lineas.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  aria-label="Quitar línea"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLineas((prev) => [...prev, { productoId: '', varianteId: '', cantidad: '1', costoUnitario: '' }])}
            className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Agregar línea
          </button>
        </div>

        <p className="text-right text-sm font-medium text-slate-700 dark:text-slate-300">
          Total: RD$ {total.toLocaleString('es-DO')}
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear orden de compra'}
        </Button>
      </form>
    </Modal>
  );
}

/** Ítem E-1 — editar una OC en BORRADOR (el proveedor no se puede cambiar, solo las líneas). */
function ModalEditarOrdenCompra({ orden, onClose }: { orden: OrdenCompra; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [lineas, setLineas] = useState<{ productoId: string; varianteId: string; cantidad: string; costoUnitario: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['orden-compra', orden.id],
    queryFn: async () => (await apiClient.get<OrdenCompraDetalle>(`/compras/${orden.id}`)).data,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  useEffect(() => {
    if (detalle && lineas.length === 0) {
      setLineas(
        detalle.lineas.map((l) => ({
          productoId: l.productoId,
          varianteId: l.varianteId,
          cantidad: String(l.cantidad),
          costoUnitario: String(l.costoUnitario),
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle]);

  const total = lineas.reduce((acc, l) => acc + Number(l.cantidad || 0) * Number(l.costoUnitario || 0), 0);

  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/compras/${orden.id}`, {
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId || undefined,
            cantidad: Number(l.cantidad),
            costoUnitario: Number(l.costoUnitario),
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', orden.id] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la orden de compra. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.filter((l) => l.productoId).length === 0) {
      setError('Agregá al menos una línea con producto.');
      return;
    }
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar orden de compra — ${orden.numero}`} onClose={onClose}>
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Proveedor: <span className="font-medium text-slate-700 dark:text-slate-300">{orden.proveedor?.nombre}</span>
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
            {lineas.map((linea, i) => (
              <div key={i} className="flex gap-2">
                <SelectorLineaProducto
                  productos={productos ?? []}
                  productoId={linea.productoId}
                  varianteId={linea.varianteId}
                  onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Cant."
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                  className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Costo"
                  value={linea.costoUnitario}
                  onChange={(e) => actualizarLinea(i, { costoUnitario: e.target.value })}
                  className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {lineas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label="Quitar línea"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLineas((prev) => [...prev, { productoId: '', varianteId: '', cantidad: '1', costoUnitario: '' }])}
              className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
            >
              + Agregar línea
            </button>
          </div>

          <p className="text-right text-sm font-medium text-slate-700 dark:text-slate-300">
            Total: RD$ {total.toLocaleString('es-DO')}
          </p>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

function NuevoProveedorInline({ onCreado }: { onCreado: (p: Proveedor) => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<Proveedor>('/proveedores', { nombre })).data,
    onSuccess: (proveedor) => onCreado(proveedor),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el proveedor.')),
  });

  return (
    <div className="mt-1 flex items-end gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
      <div className="flex-1">
        <FormField
          id="nuevo-proveedor-nombre"
          label="Nombre del proveedor"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <Button
        type="button"
        variante="secundario"
        disabled={!nombre || crear.isPending}
        onClick={() => crear.mutate()}
      >
        Crear
      </Button>
    </div>
  );
}

function ModalRecibirOrden({ orden, onClose }: { orden: OrdenCompra; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [facturaProveedorNumero, setFacturaProveedorNumero] = useState('');
  const [montoFacturaProveedor, setMontoFacturaProveedor] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [numerosLote, setNumerosLote] = useState<Record<string, string>>({});
  const [fechasVencimiento, setFechasVencimiento] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ diferenciaVsFactura: number | null } | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['orden-compra', orden.id],
    queryFn: async () => (await apiClient.get<OrdenCompraDetalle>(`/compras/${orden.id}`)).data,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const lineasPendientes = (detalle?.lineas ?? []).filter((l) => Number(l.cantidad) > Number(l.cantidadRecibida));

  const recibir = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ diferenciaVsFactura: number | null }>(`/compras/${orden.id}/recibir`, {
          bodegaId,
          facturaProveedorNumero: facturaProveedorNumero || undefined,
          montoFacturaProveedor: montoFacturaProveedor ? Number(montoFacturaProveedor) : undefined,
          lineas: lineasPendientes
            .filter((l) => Number(cantidades[l.productoId] ?? 0) > 0)
            .map((l) => ({
              productoId: l.productoId,
              cantidadRecibida: Number(cantidades[l.productoId]),
              costoUnitario: Number(l.costoUnitario),
              ...(l.producto.controlaVencimiento
                ? { numeroLote: numerosLote[l.productoId], fechaVencimiento: fechasVencimiento[l.productoId] || undefined }
                : {}),
            })),
        })
      ).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      setResultado(data);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo recibir la orden. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    recibir.mutate();
  }

  function nombreProducto(productoId: string) {
    const p = productos?.find((p) => p.id === productoId);
    return p ? `${p.codigo} — ${p.nombre}` : productoId;
  }

  if (resultado) {
    return (
      <Modal titulo={`Orden ${orden.numero} recibida`} onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">La recepción se registró correctamente.</p>
          {resultado.diferenciaVsFactura !== null && (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Diferencia vs. factura del proveedor: RD$ {resultado.diferenciaVsFactura.toLocaleString('es-DO')}
            </p>
          )}
          <Button onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Recibir orden ${orden.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega destino</label>
          <SelectorBodega value={bodegaId} onChange={setBodegaId} required />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas pendientes</p>
          {lineasPendientes.length === 0 && (
            <p className="text-sm text-slate-400">No hay líneas pendientes por recibir.</p>
          )}
          {lineasPendientes.map((linea) => {
            const pendiente = Number(linea.cantidad) - Number(linea.cantidadRecibida);
            return (
              <div key={linea.productoId} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{nombreProducto(linea.productoId)}</span>
                  <span className="text-slate-400">pendiente {pendiente}</span>
                  <input
                    type="number"
                    min={0}
                    max={pendiente}
                    placeholder="Recibir"
                    value={cantidades[linea.productoId] ?? ''}
                    onChange={(e) => setCantidades((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                    className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                {linea.producto.controlaVencimiento && Number(cantidades[linea.productoId] ?? 0) > 0 && (
                  <div className="flex items-center gap-2 pl-2 text-xs">
                    <input
                      type="text"
                      placeholder="Número de lote"
                      value={numerosLote[linea.productoId] ?? ''}
                      onChange={(e) => setNumerosLote((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      required
                    />
                    <input
                      type="date"
                      value={fechasVencimiento[linea.productoId] ?? ''}
                      onChange={(e) => setFechasVencimiento((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                      className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      required
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <FormField
          id="recibir-factura-numero"
          label="Número de factura del proveedor (opcional)"
          value={facturaProveedorNumero}
          onChange={(e) => setFacturaProveedorNumero(e.target.value)}
        />
        <FormField
          id="recibir-factura-monto"
          label="Monto de la factura del proveedor (opcional)"
          type="number"
          min={0}
          step="0.01"
          value={montoFacturaProveedor}
          onChange={(e) => setMontoFacturaProveedor(e.target.value)}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={recibir.isPending || lineasPendientes.length === 0} className="w-full">
          {recibir.isPending ? 'Recibiendo…' : 'Recibir'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalDevolverOrden({ orden, onClose }: { orden: OrdenCompra; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [lotesElegidos, setLotesElegidos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['orden-compra', orden.id],
    queryFn: async () => (await apiClient.get<OrdenCompraDetalle>(`/compras/${orden.id}`)).data,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const lineasDevolvibles = (detalle?.lineas ?? []).filter((l) => Number(l.cantidadRecibida) > 0);

  function nombreProducto(productoId: string) {
    const p = productos?.find((p) => p.id === productoId);
    return p ? `${p.codigo} — ${p.nombre}` : productoId;
  }

  const devolver = useMutation({
    mutationFn: async () =>
      apiClient.post(`/compras/${orden.id}/devolver`, {
        bodegaId,
        motivo: motivo || undefined,
        lineas: lineasDevolvibles
          .filter((l) => Number(cantidades[l.productoId] ?? 0) > 0)
          .map((l) => ({
            productoId: l.productoId,
            cantidad: Number(cantidades[l.productoId]),
            ...(l.producto.controlaVencimiento ? { loteId: lotesElegidos[l.productoId] } : {}),
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden-compra', orden.id] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la devolución. Revisa las cantidades.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    devolver.mutate();
  }

  return (
    <Modal titulo={`Devolver a proveedor — orden ${orden.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega de donde sale la mercancía</label>
          <SelectorBodega value={bodegaId} onChange={setBodegaId} required />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas recibidas</p>
          {lineasDevolvibles.length === 0 && <p className="text-sm text-slate-400">No hay mercancía recibida por devolver.</p>}
          {lineasDevolvibles.map((linea) => (
            <div key={linea.productoId} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">{nombreProducto(linea.productoId)}</span>
                <span className="text-slate-400">recibido {linea.cantidadRecibida}</span>
                <input
                  type="number"
                  min={0}
                  max={Number(linea.cantidadRecibida)}
                  placeholder="Devolver"
                  value={cantidades[linea.productoId] ?? ''}
                  onChange={(e) => setCantidades((prev) => ({ ...prev, [linea.productoId]: e.target.value }))}
                  className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              {linea.producto.controlaVencimiento && bodegaId && Number(cantidades[linea.productoId] ?? 0) > 0 && (
                <SelectorLoteDevolucion
                  varianteId={linea.varianteId}
                  bodegaId={bodegaId}
                  value={lotesElegidos[linea.productoId] ?? ''}
                  onChange={(loteId) => setLotesElegidos((prev) => ({ ...prev, [linea.productoId]: loteId }))}
                />
              )}
            </div>
          ))}
        </div>

        <FormField id="devolver-motivo" label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={devolver.isPending || lineasDevolvibles.length === 0} className="w-full">
          {devolver.isPending ? 'Registrando…' : 'Devolver a proveedor'}
        </Button>
      </form>
    </Modal>
  );
}

/** Fase 5b — de qué lote sale la devolución a proveedor (siempre a mano, nunca FEFO: ver ARCHITECTURE.md). */
function SelectorLoteDevolucion({
  varianteId,
  bodegaId,
  value,
  onChange,
}: {
  varianteId: string;
  bodegaId: string;
  value: string;
  onChange: (loteId: string) => void;
}) {
  const { data: lotes } = useQuery({
    queryKey: ['inventario-lotes', varianteId, bodegaId],
    queryFn: async () => (await apiClient.get<Lote[]>('/inventario/lotes', { params: { varianteId, bodegaId } })).data,
  });

  return (
    <div className="pl-2">
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="text-xs" required>
        <option value="">De qué lote sale…</option>
        {lotes?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.numeroLote} — vence {new Date(l.fechaVencimiento).toLocaleDateString('es-DO', { timeZone: 'UTC' })} — saldo {Number(l.cantidadActual)}
          </option>
        ))}
      </Select>
    </div>
  );
}
