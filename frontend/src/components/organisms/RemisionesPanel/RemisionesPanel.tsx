import { FormEvent, useEffect, useState } from 'react';
import { User } from 'lucide-react';
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
        descripcion={data ? `${data.total} remisión(es) — el inventario se descuenta al convertir en factura, no al crear` : undefined}
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
                  <tr key={remision.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono text-xs">{remision.numero}</td>
                    <td className="px-5 py-3">{remision.cliente?.nombre}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_POR_ESTADO[remision.estado]}>{remision.estado}</Badge>
                      {remision.facturaId && <span className="ml-2 text-xs text-slate-400">Ya facturada</span>}
                    </td>
                    <td className="px-5 py-3 text-right">{acciones.length > 0 && <RowActionsMenu acciones={acciones} />}</td>
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
    </div>
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
    <Modal titulo="Nueva remisión" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Registra la entrega de mercancía sin facturar todavía. El inventario se descuenta al convertirla en factura, no al crearla.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
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

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex items-center gap-2">
              <SelectorLineaProducto
                productos={productos}
                productoId={linea.productoId}
                varianteId={linea.varianteId}
                onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                step="any"
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {lineas.length > 1 && (
                <Button type="button" variante="secundario" onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}>
                  Quitar
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variante="secundario" onClick={() => setLineas((prev) => [...prev, { productoId: '', varianteId: '', cantidad: '1' }])}>
            + Línea
          </Button>
        </div>

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
  const [error, setError] = useState<string | null>(null);

  const convertir = useMutation({
    mutationFn: async () => apiClient.post(`/remisiones/${remision.id}/convertir`, { tipoFactura }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      onClose();
    },
    onError: () => setError('No se pudo convertir la remisión en factura.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={convertir.isPending} className="w-full">
          {convertir.isPending ? 'Convirtiendo…' : 'Convertir en factura'}
        </Button>
      </form>
    </Modal>
  );
}
