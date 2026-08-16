import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { abrirBlob } from '../../../lib/descargar-archivo';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { Badge } from '../../atoms/Badge/Badge';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
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
  lineas: { productoId: string; cantidad: string }[];
}

const TONO_POR_ESTADO: Record<EstadoRemision, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  BORRADOR: 'neutro',
  ENTREGADA: 'advertencia',
  FACTURADA: 'exito',
  ANULADA: 'peligro',
};

type LineaForm = { productoId: string; cantidad: string };

export function RemisionesPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const [clienteId, setClienteId] = useState('');
  const [bodegaId, setBodegaId] = useState('');
  const [numero, setNumero] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([{ productoId: '', cantidad: '1' }]);
  const [error, setError] = useState<string | null>(null);

  const [remisionEditando, setRemisionEditando] = useState<Remision | null>(null);
  const [remisionConvirtiendo, setRemisionConvirtiendo] = useState<Remision | null>(null);

  async function verPdf(id: string) {
    const respuesta = await apiClient.get(`/remisiones/${id}/pdf`, { responseType: 'blob' });
    abrirBlob(respuesta.data);
  }

  const { data: clientes } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { tamanoPagina: 100 } })).data.datos,
  });
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

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/remisiones', {
        clienteId,
        bodegaId,
        numero,
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      setClienteId('');
      setBodegaId('');
      setNumero('');
      setLineas([{ productoId: '', cantidad: '1' }]);
      setError(null);
    },
    onError: () => setError('No se pudo crear la remisión. Revisa que el número no esté repetido.'),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'ENTREGADA' | 'ANULADA' }) =>
      apiClient.patch(`/remisiones/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remisiones'] }),
  });

  function agregarLinea() {
    setLineas((prev) => [...prev, { productoId: '', cantidad: '1' }]);
  }

  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function quitarLinea(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <div className="space-y-4">
      {tienePermiso('remisiones.crear') && (
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-medium text-slate-900 dark:text-slate-100">Nueva remisión</h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Registra la entrega de mercancía sin facturar todavía. El inventario se descuenta al convertirla en factura, no al crearla.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <FormField id="numero" label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
              <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {clientes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
              <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {bodegas?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
            {lineas.map((linea, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={linea.productoId}
                  onChange={(e) => actualizarLinea(i, { productoId: e.target.value })}
                  required
                  className="flex-1"
                >
                  <option value="">Producto…</option>
                  {productos?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.codigo})
                    </option>
                  ))}
                </Select>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={linea.cantidad}
                  onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                  className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {lineas.length > 1 && (
                  <Button type="button" variante="secundario" onClick={() => quitarLinea(i)}>
                    Quitar
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variante="secundario" onClick={agregarLinea}>
              + Línea
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Creando…' : 'Crear remisión'}
          </Button>
        </form>
      </div>
      )}

      <SearchInput
        value={busqueda}
        onChange={(v) => {
          setBusqueda(v);
          setPagina(1);
        }}
        placeholder="Buscar por número o cliente…"
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Número</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.datos.map((remision) => {
              const acciones = [
                { etiqueta: 'Ver PDF', onClick: () => verPdf(remision.id) },
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
                <tr key={remision.id}>
                  <td className="px-4 py-2 font-mono text-xs">{remision.numero}</td>
                  <td className="px-4 py-2">{remision.cliente?.nombre}</td>
                  <td className="px-4 py-2">
                    <Badge tono={TONO_POR_ESTADO[remision.estado]}>{remision.estado}</Badge>
                    {remision.facturaId && <span className="ml-2 text-xs text-slate-400">Ya facturada</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{acciones.length > 0 && <RowActionsMenu acciones={acciones} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && (
        <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
      )}

      {remisionEditando && (
        <ModalEditarRemision
          remisionId={remisionEditando.id}
          numeroActual={remisionEditando.numero}
          productos={productos ?? []}
          clientes={clientes ?? []}
          bodegas={bodegas ?? []}
          onClose={() => setRemisionEditando(null)}
        />
      )}
      {remisionConvirtiendo && (
        <ModalConvertirRemision remision={remisionConvirtiendo} onClose={() => setRemisionConvirtiendo(null)} />
      )}
    </div>
  );
}

function ModalEditarRemision({
  remisionId,
  numeroActual,
  productos,
  clientes,
  bodegas,
  onClose,
}: {
  remisionId: string;
  numeroActual: string;
  productos: Producto[];
  clientes: Cliente[];
  bodegas: Bodega[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [valores, setValores] = useState<{ numero: string; clienteId: string; bodegaId: string; lineas: LineaForm[] } | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['remision-detalle', remisionId],
    queryFn: async () => (await apiClient.get<Remision>(`/remisiones/${remisionId}`)).data,
  });

  useEffect(() => {
    if (!detalle) return;
    setValores({
      numero: detalle.numero,
      clienteId: detalle.clienteId,
      bodegaId: detalle.bodegaId,
      lineas: detalle.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
    });
  }, [detalle]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/remisiones/${remisionId}`, {
        numero: valores!.numero,
        clienteId: valores!.clienteId,
        bodegaId: valores!.bodegaId,
        lineas: valores!.lineas.filter((l) => l.productoId).map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
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
        <FormField
          id="editar-rem-numero"
          label="Número"
          value={valores.numero}
          onChange={(e) => setValores({ ...valores, numero: e.target.value })}
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
          <Select value={valores.clienteId} onChange={(e) => setValores({ ...valores, clienteId: e.target.value })} required>
            <option value="">Seleccionar…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
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
              <Select
                value={linea.productoId}
                onChange={(e) =>
                  setValores({ ...valores, lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, productoId: e.target.value } : l)) })
                }
                required
                className="flex-1"
              >
                <option value="">Producto…</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.codigo})
                  </option>
                ))}
              </Select>
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
            onClick={() => setValores({ ...valores, lineas: [...valores.lineas, { productoId: '', cantidad: '1' }] })}
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
