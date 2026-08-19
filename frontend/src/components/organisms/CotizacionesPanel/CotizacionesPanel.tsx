import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
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

type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA';

interface LineaCotizacion {
  productoId: string;
  cantidad: string;
  producto?: { nombre: string; codigo: string };
}

interface Cotizacion {
  id: string;
  numero: string;
  estado: EstadoCotizacion;
  total: string;
  fechaVigenciaHasta: string;
  facturaId: string | null;
  clienteId: string;
  cliente: { nombre: string };
  lineas: LineaCotizacion[];
}

const TONO_POR_ESTADO: Record<EstadoCotizacion, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  BORRADOR: 'neutro',
  ENVIADA: 'advertencia',
  ACEPTADA: 'exito',
  RECHAZADA: 'peligro',
  VENCIDA: 'peligro',
};

type LineaForm = { productoId: string; cantidad: string };

export function CotizacionesPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalNuevaCotizacion, setModalNuevaCotizacion] = useState(false);

  const [cotizacionEditando, setCotizacionEditando] = useState<Cotizacion | null>(null);
  const [cotizacionConvirtiendo, setCotizacionConvirtiendo] = useState<Cotizacion | null>(null);
  const [cotizacionImprimiendo, setCotizacionImprimiendo] = useState<Cotizacion | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const { data } = useQuery({
    queryKey: ['cotizaciones', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Cotizacion>>('/cotizaciones', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' }) =>
      apiClient.patch(`/cotizaciones/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cotizaciones'] }),
  });

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        titulo="Cotizaciones"
        descripcion={data ? `${data.total} cotización(es)` : undefined}
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
            {tienePermiso('cotizaciones.crear') && <Button onClick={() => setModalNuevaCotizacion(true)}>Nueva cotización</Button>}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Válida hasta</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.datos.map((cotizacion) => {
                const acciones = [
                  { etiqueta: 'Imprimir', onClick: () => setCotizacionImprimiendo(cotizacion) },
                  ...(tienePermiso('cotizaciones.editar') && cotizacion.estado === 'BORRADOR'
                    ? [{ etiqueta: 'Editar', onClick: () => setCotizacionEditando(cotizacion) }]
                    : []),
                  ...(tienePermiso('cotizaciones.editar') && cotizacion.estado === 'BORRADOR'
                    ? [{ etiqueta: 'Enviar', onClick: () => cambiarEstado.mutate({ id: cotizacion.id, estado: 'ENVIADA' }) }]
                    : []),
                  ...(tienePermiso('cotizaciones.editar') && (cotizacion.estado === 'BORRADOR' || cotizacion.estado === 'ENVIADA')
                    ? [
                        { etiqueta: 'Aceptar', onClick: () => cambiarEstado.mutate({ id: cotizacion.id, estado: 'ACEPTADA' }) },
                        { etiqueta: 'Rechazar', onClick: () => cambiarEstado.mutate({ id: cotizacion.id, estado: 'RECHAZADA' }), tono: 'peligro' as const },
                      ]
                    : []),
                  ...(tienePermiso('cotizaciones.editar') && cotizacion.estado === 'ACEPTADA' && !cotizacion.facturaId
                    ? [{ etiqueta: 'Convertir en factura', onClick: () => setCotizacionConvirtiendo(cotizacion) }]
                    : []),
                ];

                return (
                  <tr key={cotizacion.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{cotizacion.numero}</td>
                    <td className="px-5 py-3">{cotizacion.cliente?.nombre}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(cotizacion.total).toLocaleString('es-DO')}</td>
                    <td className="px-5 py-3">{new Date(cotizacion.fechaVigenciaHasta).toLocaleDateString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_POR_ESTADO[cotizacion.estado]}>{cotizacion.estado}</Badge>
                      {cotizacion.facturaId && <span className="ml-2 text-xs text-slate-400">Ya facturada</span>}
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

      {modalNuevaCotizacion && (
        <ModalNuevaCotizacion
          productos={productos ?? []}
          clientes={clientes ?? []}
          onClose={() => setModalNuevaCotizacion(false)}
        />
      )}

      {cotizacionEditando && (
        <ModalEditarCotizacion
          cotizacion={cotizacionEditando}
          productos={productos ?? []}
          clientes={clientes ?? []}
          onClose={() => setCotizacionEditando(null)}
        />
      )}
      {cotizacionConvirtiendo && (
        <ModalConvertirCotizacion cotizacion={cotizacionConvirtiendo} onClose={() => setCotizacionConvirtiendo(null)} />
      )}
      {cotizacionImprimiendo && (
        <ModalImprimir
          urlBase={`/cotizaciones/${cotizacionImprimiendo.id}`}
          titulo={`Imprimir — ${cotizacionImprimiendo.numero}`}
          onClose={() => setCotizacionImprimiendo(null)}
        />
      )}
    </div>
  );
}

function ModalNuevaCotizacion({
  productos,
  clientes,
  onClose,
}: {
  productos: Producto[];
  clientes: Cliente[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([{ productoId: '', cantidad: '1' }]);
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/cotizaciones', {
        numero,
        clienteId,
        fechaVigenciaHasta,
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onClose();
    },
    onError: () => setError('No se pudo crear la cotización. Revisa los datos.'),
  });

  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva cotización" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="numero" label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        <FormField
          id="fechaVigenciaHasta"
          label="Válida hasta"
          type="date"
          value={fechaVigenciaHasta}
          onChange={(e) => setFechaVigenciaHasta(e.target.value)}
          required
        />

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
          <Button type="button" variante="secundario" onClick={() => setLineas((prev) => [...prev, { productoId: '', cantidad: '1' }])}>
            + Línea
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear cotización'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalEditarCotizacion({
  cotizacion,
  productos,
  clientes,
  onClose,
}: {
  cotizacion: Cotizacion;
  productos: Producto[];
  clientes: Cliente[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState(cotizacion.numero);
  const [clienteId, setClienteId] = useState(cotizacion.clienteId);
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState(cotizacion.fechaVigenciaHasta.slice(0, 10));
  const [lineas, setLineas] = useState<LineaForm[]>(
    cotizacion.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
  );
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/cotizaciones/${cotizacion.id}`, {
        numero,
        clienteId,
        fechaVigenciaHasta,
        lineas: lineas.filter((l) => l.productoId).map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onClose();
    },
    onError: () => setError('No se pudo guardar la cotización. Revisa los datos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar cotización ${cotizacion.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="editar-numero" label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        <FormField
          id="editar-vigencia"
          label="Válida hasta"
          type="date"
          value={fechaVigenciaHasta}
          onChange={(e) => setFechaVigenciaHasta(e.target.value)}
          required
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={linea.productoId}
                onChange={(e) => setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, productoId: e.target.value } : l)))}
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
                onChange={(e) => setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, cantidad: e.target.value } : l)))}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {lineas.length > 1 && (
                <Button type="button" variante="secundario" onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}>
                  Quitar
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variante="secundario" onClick={() => setLineas((prev) => [...prev, { productoId: '', cantidad: '1' }])}>
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

function ModalConvertirCotizacion({ cotizacion, onClose }: { cotizacion: Cotizacion; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [error, setError] = useState<string | null>(null);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const convertir = useMutation({
    mutationFn: async () => apiClient.post(`/cotizaciones/${cotizacion.id}/convertir`, { bodegaId, tipoFactura }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onClose();
    },
    onError: () => setError('No se pudo convertir la cotización en factura.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    convertir.mutate();
  }

  return (
    <Modal titulo={`Convertir en factura — ${cotizacion.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega (de donde sale el inventario)</label>
          <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bodegas?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </div>
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
