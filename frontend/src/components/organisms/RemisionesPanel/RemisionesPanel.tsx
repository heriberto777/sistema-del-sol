import { FormEvent, useEffect, useState } from 'react';
import { Eye, Plus, User, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { Badge } from '../../atoms/Badge/Badge';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { SelectorLineaProducto } from '../../molecules/SelectorLineaProducto/SelectorLineaProducto';
import { TablaArticulosDocumento } from '../../molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { SelectFormaPago } from '../../molecules/SelectFormaPago/SelectFormaPago';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Cliente {
  id: string;
  nombre: string;
}

interface Producto {
  id: string;
  nombre: string;
  codigo: string;
}

interface Bodega {
  id: string;
  nombre: string;
}

type EstadoRemision = 'BORRADOR' | 'ENTREGADA' | 'FACTURADA' | 'ANULADA';

interface Remision {
  id: string;
  numero: string;
  estado: EstadoRemision;
  facturaId: string | null;
  clienteId: string;
  bodegaId: string;
  cliente: { nombre: string };
  lineas: { productoId: string; varianteId: string; cantidad: string }[];
}

interface RemisionDetalle extends Omit<Remision, 'lineas'> {
  fecha: string;
  bodega: { nombre: string };
  lineas: { producto: { nombre: string } | null; cantidad: string }[];
}

const TONO_POR_ESTADO: Record<EstadoRemision, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  BORRADOR: 'neutro',
  ENTREGADA: 'advertencia',
  FACTURADA: 'exito',
  ANULADA: 'peligro',
};

type LineaForm = { productoId: string; varianteId: string; cantidad: string };

export function RemisionesPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalNuevaRemision, setModalNuevaRemision] = useState(false);

  const [remisionEditando, setRemisionEditando] = useState<Remision | null>(null);
  const [remisionConvirtiendo, setRemisionConvirtiendo] = useState<Remision | null>(null);
  const [remisionImprimiendo, setRemisionImprimiendo] = useState<Remision | null>(null);
  const [remisionViendo, setRemisionViendo] = useState<Remision | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const { data } = useQuery({
    queryKey: ['remisiones', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Remision>>('/remisiones', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'ENTREGADA' | 'ANULADA' }) =>
      apiClient.patch(`/remisiones/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remisiones'] }),
  });

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        titulo="Remisiones"
        descripcion={data ? `${data.total} remisión(es) — el inventario se descuenta al marcar "Entregada", no al crear` : undefined}
        acciones={
          <div className="flex items-center gap-2">
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por número o cliente…"
            />
            {tienePermiso('remisiones.crear') && <Button onClick={() => setModalNuevaRemision(true)}>Nueva remisión</Button>}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.datos.map((remision) => {
                const acciones = [
                  { etiqueta: 'Imprimir', onClick: () => setRemisionImprimiendo(remision) },
                  ...(tienePermiso('remisiones.editar') && remision.estado === 'BORRADOR'
                    ? [{ etiqueta: 'Editar', onClick: () => setRemisionEditando(remision) }]
                    : []),
                  ...(tienePermiso('remisiones.editar') && remision.estado === 'BORRADOR'
                    ? [{ etiqueta: 'Marcar entregada', onClick: () => cambiarEstado.mutate({ id: remision.id, estado: 'ENTREGADA' }) }]
                    : []),
                  ...(tienePermiso('remisiones.editar') && (remision.estado === 'BORRADOR' || remision.estado === 'ENTREGADA')
                    ? [
                        { etiqueta: 'Convertir en factura', onClick: () => setRemisionConvirtiendo(remision) },
                        { etiqueta: 'Anular', onClick: () => cambiarEstado.mutate({ id: remision.id, estado: 'ANULADA' }), tono: 'peligro' as const },
                      ]
                    : []),
                ];

                return (
                  <tr
                    key={remision.id}
                    onClick={() => setRemisionViendo(remision)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 font-mono text-xs">{remision.numero}</td>
                    <td className="px-5 py-3">{remision.cliente?.nombre}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_POR_ESTADO[remision.estado]}>{remision.estado}</Badge>
                      {remision.facturaId && <span className="ml-2 text-xs text-slate-400">Ya facturada</span>}
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setRemisionViendo(remision)}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          aria-label="Ver detalle"
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        {acciones.length > 0 && <RowActionsMenu acciones={acciones} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {modalNuevaRemision && (
        <ModalNuevaRemision productos={productos ?? []} bodegas={bodegas ?? []} onClose={() => setModalNuevaRemision(false)} />
      )}

      {remisionEditando && (
        <ModalEditarRemision
          remisionId={remisionEditando.id}
          numeroActual={remisionEditando.numero}
          productos={productos ?? []}
          bodegas={bodegas ?? []}
          onClose={() => setRemisionEditando(null)}
        />
      )}
      {remisionConvirtiendo && (
        <ModalConvertirRemision remision={remisionConvirtiendo} onClose={() => setRemisionConvirtiendo(null)} />
      )}
      {remisionImprimiendo && (
        <ModalImprimir
          urlBase={`/remisiones/${remisionImprimiendo.id}`}
          titulo={`Imprimir — ${remisionImprimiendo.numero}`}
          onClose={() => setRemisionImprimiendo(null)}
        />
      )}
      {remisionViendo && (
        <ModalDetalleRemision
          remision={remisionViendo}
          onClose={() => setRemisionViendo(null)}
          onImprimir={() => {
            setRemisionImprimiendo(remisionViendo);
            setRemisionViendo(null);
          }}
        />
      )}
    </div>
  );
}

function ModalDetalleRemision({ remision, onClose, onImprimir }: { remision: Remision; onClose: () => void; onImprimir: () => void }) {
  const { data: detalle } = useQuery({
    queryKey: ['remision-detalle-ver', remision.id],
    queryFn: async () => (await apiClient.get<RemisionDetalle>(`/remisiones/${remision.id}`)).data,
  });

  return (
    <Modal titulo={`Remisión ${remision.numero}`} onClose={onClose} ancho="2xl">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <Badge tono={TONO_POR_ESTADO[remision.estado]}>{remision.estado}</Badge>
          {detalle?.fecha && (
            <p className="text-right text-sm text-slate-500 dark:text-slate-400">
              Fecha
              <br />
              <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(detalle.fecha).toLocaleDateString('es-DO')}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p className="text-slate-500 dark:text-slate-400">Cliente</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{remision.cliente?.nombre}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <p className="text-slate-500 dark:text-slate-400">Bodega</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{detalle?.bodega?.nombre ?? '—'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variante="secundario" onClick={onImprimir}>
            Imprimir / descargar PDF
          </Button>
        </div>

        {!detalle ? <p className="text-sm text-slate-500">Cargando…</p> : <TablaArticulosDocumento lineas={detalle.lineas} mostrarPrecios={false} />}
      </div>
    </Modal>
  );
}

function ModalNuevaRemision({
  productos,
  bodegas,
  onClose,
}: {
  productos: Producto[];
  bodegas: Bodega[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [bodegaId, setBodegaId] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([{ productoId: '', varianteId: '', cantidad: '1' }]);
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/remisiones', {
        clienteId: cliente?.id,
        bodegaId,
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({ productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      onClose();
    },
    onError: () => setError('No se pudo crear la remisión. Revisa que el número no esté repetido.'),
  });

  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setError('Seleccioná un cliente.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva remisión" onClose={onClose} ancho="2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <Card
          titulo="Información de la remisión"
          descripcion={'Se crea en borrador (sin tocar inventario) — el descuento real ocurre al marcar "Entregada".'}
          contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
            <ComboboxBusqueda<Cliente>
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
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
            <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card titulo="Líneas">
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Descripción</th>
                    <th className="w-24 px-3 py-2 font-medium">Cant</th>
                    <th className="w-px px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineas.map((linea, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 align-top">
                        <SelectorLineaProducto
                          productos={productos}
                          productoId={linea.productoId}
                          varianteId={linea.varianteId}
                          onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={1}
                          step="any"
                          value={linea.cantidad}
                          onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        {lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-red-600 hover:text-red-700"
                            aria-label="Quitar línea"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setLineas((prev) => [...prev, { productoId: '', varianteId: '', cantidad: '1' }])}
              className="flex items-center gap-1 text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
            >
              <Plus size={15} /> Agregar línea
            </button>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear remisión'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalEditarRemision({
  remisionId,
  numeroActual,
  productos,
  bodegas,
  onClose,
}: {
  remisionId: string;
  numeroActual: string;
  productos: Producto[];
  bodegas: Bodega[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [valores, setValores] = useState<{ bodegaId: string; lineas: LineaForm[] } | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['remision-detalle', remisionId],
    queryFn: async () => (await apiClient.get<Remision>(`/remisiones/${remisionId}`)).data,
  });

  useEffect(() => {
    if (!detalle) return;
    setCliente({ id: detalle.clienteId, nombre: detalle.cliente.nombre });
    setValores({
      bodegaId: detalle.bodegaId,
      lineas: detalle.lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad })),
    });
  }, [detalle]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/remisiones/${remisionId}`, {
        clienteId: cliente?.id,
        bodegaId: valores!.bodegaId,
        lineas: valores!.lineas.filter((l) => l.productoId).map((l) => ({ productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      onClose();
    },
    onError: () => setError('No se pudo guardar la remisión. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setError('Seleccioná un cliente.');
      return;
    }
    guardar.mutate();
  }

  if (!valores) {
    return (
      <Modal titulo={`Editar remisión ${numeroActual}`} onClose={onClose}>
        <p className="text-sm text-slate-500">Cargando…</p>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Editar remisión ${numeroActual}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Número <span className="font-medium text-slate-700 dark:text-slate-300">{numeroActual}</span> (asignado automáticamente, no editable)
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
          <ComboboxBusqueda<Cliente>
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
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
          <Select value={valores.bodegaId} onChange={(e) => setValores({ ...valores, bodegaId: e.target.value })} required>
            <option value="">Seleccionar…</option>
            {bodegas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {valores.lineas.map((linea, i) => (
            <div key={i} className="flex items-center gap-2">
              <SelectorLineaProducto
                productos={productos}
                productoId={linea.productoId}
                varianteId={linea.varianteId}
                onChange={(productoId, varianteId) =>
                  setValores({
                    ...valores,
                    lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, productoId, varianteId } : l)),
                  })
                }
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                step="any"
                value={linea.cantidad}
                onChange={(e) =>
                  setValores({ ...valores, lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, cantidad: e.target.value } : l)) })
                }
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {valores.lineas.length > 1 && (
                <Button
                  type="button"
                  variante="secundario"
                  onClick={() => setValores({ ...valores, lineas: valores.lineas.filter((_, idx) => idx !== i) })}
                >
                  Quitar
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variante="secundario"
            onClick={() => setValores({ ...valores, lineas: [...valores.lineas, { productoId: '', varianteId: '', cantidad: '1' }] })}
          >
            + Línea
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalConvertirRemision({ remision, onClose }: { remision: Remision; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [formaPagoId, setFormaPagoId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const convertir = useMutation({
    mutationFn: async () =>
      apiClient.post(`/remisiones/${remision.id}/convertir`, {
        tipoFactura,
        formaPagoId: tipoFactura === 'CONTADO' ? formaPagoId || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      onClose();
    },
    onError: () => setError('No se pudo convertir la remisión en factura.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (tipoFactura === 'CONTADO' && !formaPagoId) {
      setError('Seleccioná la forma de pago.');
      return;
    }
    convertir.mutate();
  }

  return (
    <Modal titulo={`Convertir en factura — ${remision.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de factura</label>
          <Select value={tipoFactura} onChange={(e) => setTipoFactura(e.target.value as 'CONTADO' | 'CREDITO')}>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </div>
        {tipoFactura === 'CONTADO' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Forma de pago</label>
            <SelectFormaPago value={formaPagoId} onChange={setFormaPagoId} />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={convertir.isPending} className="w-full">
          {convertir.isPending ? 'Convirtiendo…' : 'Convertir en factura'}
        </Button>
      </form>
    </Modal>
  );
}
