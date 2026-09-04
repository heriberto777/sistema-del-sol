import { FormEvent, useEffect, useState } from 'react';
import { Eye, User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { FormField } from '../../molecules/FormField/FormField';
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
import { TablaLineasEditable } from '../../molecules/TablaLineasEditable/TablaLineasEditable';
import { TablaArticulosDocumento } from '../../molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { BloqueTotalesDocumento } from '../../molecules/BloqueTotalesDocumento/BloqueTotalesDocumento';
import { SelectFormaPago } from '../../molecules/SelectFormaPago/SelectFormaPago';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

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
  productoId: string | null;
  varianteId: string | null;
  descripcionManual?: string | null;
  cantidad: string;
  precioUnitario: string;
  montoTotal?: string;
  producto?: { nombre: string; codigo: string };
}

interface Cotizacion {
  id: string;
  numero: string;
  estado: EstadoCotizacion;
  total: string;
  subtotal?: string;
  descuento?: string;
  itbis?: string;
  createdAt?: string;
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

type LineaForm = {
  productoId: string;
  varianteId: string;
  cantidad: string;
  // Ítem B-9 — línea manual/libre sin producto del catálogo.
  esManual: boolean;
  descripcionManual: string;
  precioUnitario: string;
};

const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '' };

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
  const [cotizacionViendo, setCotizacionViendo] = useState<Cotizacion | null>(null);

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
                  <tr
                    key={cotizacion.id}
                    onClick={() => setCotizacionViendo(cotizacion)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3">{cotizacion.numero}</td>
                    <td className="px-5 py-3">{cotizacion.cliente?.nombre}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(cotizacion.total).toLocaleString('es-DO')}</td>
                    <td className="px-5 py-3">{new Date(cotizacion.fechaVigenciaHasta).toLocaleDateString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_POR_ESTADO[cotizacion.estado]}>{cotizacion.estado}</Badge>
                      {cotizacion.facturaId && <span className="ml-2 text-xs text-slate-400">Ya facturada</span>}
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setCotizacionViendo(cotizacion)}
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

      {modalNuevaCotizacion && (
        <ModalNuevaCotizacion productos={productos ?? []} onClose={() => setModalNuevaCotizacion(false)} />
      )}

      {cotizacionEditando && (
        <ModalEditarCotizacion
          cotizacionId={cotizacionEditando.id}
          numeroActual={cotizacionEditando.numero}
          productos={productos ?? []}
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
      {cotizacionViendo && (
        <ModalDetalleCotizacion
          cotizacion={cotizacionViendo}
          onClose={() => setCotizacionViendo(null)}
          onImprimir={() => {
            setCotizacionImprimiendo(cotizacionViendo);
            setCotizacionViendo(null);
          }}
        />
      )}
    </div>
  );
}

function ModalDetalleCotizacion({
  cotizacion,
  onClose,
  onImprimir,
}: {
  cotizacion: Cotizacion;
  onClose: () => void;
  onImprimir: () => void;
}) {
  const { data: detalle } = useQuery({
    queryKey: ['cotizacion-detalle', cotizacion.id],
    queryFn: async () => (await apiClient.get<Cotizacion>(`/cotizaciones/${cotizacion.id}`)).data,
  });

  return (
    <Modal titulo={`Cotización ${cotizacion.numero}`} onClose={onClose} ancho="2xl">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <Badge tono={TONO_POR_ESTADO[cotizacion.estado]}>{cotizacion.estado}</Badge>
          <div className="text-right text-sm text-slate-500 dark:text-slate-400">
            {detalle?.createdAt && (
              <p>
                Fecha <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(detalle.createdAt).toLocaleDateString('es-DO')}</span>
              </p>
            )}
            <p>
              Válida hasta{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(cotizacion.fechaVigenciaHasta).toLocaleDateString('es-DO')}</span>
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400">Cliente</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{cotizacion.cliente?.nombre}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variante="secundario" onClick={onImprimir}>
            Imprimir / descargar PDF
          </Button>
        </div>

        {!detalle ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <>
            <TablaArticulosDocumento lineas={detalle.lineas} />
            <BloqueTotalesDocumento subtotal={detalle.subtotal ?? 0} descuento={detalle.descuento} itbis={detalle.itbis ?? 0} total={detalle.total} />
          </>
        )}
      </div>
    </Modal>
  );
}

function ModalNuevaCotizacion({ productos, onClose }: { productos: Producto[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([LINEA_VACIA]);
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/cotizaciones', {
        clienteId: cliente?.id,
        fechaVigenciaHasta,
        lineas: lineas
          .filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim()))
          .map((l) =>
            l.esManual
              ? { descripcionManual: l.descripcionManual.trim(), cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario) }
              : { productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) },
          ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la cotización. Revisa los datos.')),
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
    if (lineas.some((l) => l.esManual && l.descripcionManual.trim() && !l.precioUnitario)) {
      setError('Una línea de producto libre necesita un precio.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva cotización" onClose={onClose} ancho="2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Información de la cotización" contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
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
          <FormField
            id="fechaVigenciaHasta"
            label="Válida hasta"
            type="date"
            value={fechaVigenciaHasta}
            onChange={(e) => setFechaVigenciaHasta(e.target.value)}
            required
          />
        </Card>

        <Card titulo="Líneas">
          <TablaLineasEditable
            lineas={lineas}
            productos={productos}
            lineaVacia={LINEA_VACIA}
            onActualizar={actualizarLinea}
            onQuitar={(i) => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
            onAgregar={(vacia) => setLineas((prev) => [...prev, vacia])}
            precioSoloManual
          />
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear cotización'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalEditarCotizacion({
  cotizacionId,
  numeroActual,
  productos,
  onClose,
}: {
  cotizacionId: string;
  numeroActual: string;
  productos: Producto[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [valores, setValores] = useState<{ fechaVigenciaHasta: string; lineas: LineaForm[] } | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['cotizacion-detalle', cotizacionId],
    queryFn: async () => (await apiClient.get<Cotizacion>(`/cotizaciones/${cotizacionId}`)).data,
  });

  useEffect(() => {
    if (!detalle) return;
    setCliente({ id: detalle.clienteId, nombre: detalle.cliente.nombre });
    setValores({
      fechaVigenciaHasta: detalle.fechaVigenciaHasta.slice(0, 10),
      lineas: detalle.lineas.map((l) => ({
        productoId: l.productoId ?? '',
        varianteId: l.varianteId ?? '',
        cantidad: l.cantidad,
        esManual: !l.productoId,
        descripcionManual: l.descripcionManual ?? '',
        precioUnitario: l.precioUnitario,
      })),
    });
  }, [detalle]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/cotizaciones/${cotizacionId}`, {
        clienteId: cliente?.id,
        fechaVigenciaHasta: valores!.fechaVigenciaHasta,
        lineas: valores!.lineas
          .filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim()))
          .map((l) =>
            l.esManual
              ? { descripcionManual: l.descripcionManual.trim(), cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario) }
              : { productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) },
          ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la cotización. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setError('Seleccioná un cliente.');
      return;
    }
    if (valores!.lineas.some((l) => l.esManual && l.descripcionManual.trim() && !l.precioUnitario)) {
      setError('Una línea de producto libre necesita un precio.');
      return;
    }
    guardar.mutate();
  }

  if (!valores) {
    return (
      <Modal titulo={`Editar cotización ${numeroActual}`} onClose={onClose}>
        <p className="text-sm text-slate-500">Cargando…</p>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Editar cotización ${numeroActual}`} onClose={onClose}>
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
        <FormField
          id="editar-vigencia"
          label="Válida hasta"
          type="date"
          value={valores.fechaVigenciaHasta}
          onChange={(e) => setValores({ ...valores, fechaVigenciaHasta: e.target.value })}
          required
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {valores.lineas.map((linea, i) => (
            <div key={i} className="flex items-center gap-2">
              {linea.esManual ? (
                <input
                  type="text"
                  placeholder="Descripción — ej. Instalación"
                  value={linea.descripcionManual}
                  onChange={(e) =>
                    setValores({ ...valores, lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, descripcionManual: e.target.value } : l)) })
                  }
                  className="flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              ) : (
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
              )}
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
              {linea.esManual && (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Precio"
                  value={linea.precioUnitario}
                  onChange={(e) =>
                    setValores({ ...valores, lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, precioUnitario: e.target.value } : l)) })
                  }
                  className="w-28 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              )}
              <button
                type="button"
                title={linea.esManual ? 'Volver a elegir del catálogo' : 'Línea libre sin producto del catálogo (ítem B-9)'}
                onClick={() =>
                  setValores({
                    ...valores,
                    lineas: valores.lineas.map((l, idx) =>
                      idx === i ? { ...l, esManual: !l.esManual, productoId: '', varianteId: '', descripcionManual: '' } : l,
                    ),
                  })
                }
                className="whitespace-nowrap text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
              >
                {linea.esManual ? 'Del catálogo' : 'Producto libre'}
              </button>
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
          <Button type="button" variante="secundario" onClick={() => setValores({ ...valores, lineas: [...valores.lineas, LINEA_VACIA] })}>
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
  const [formaPagoId, setFormaPagoId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const convertir = useMutation({
    mutationFn: async () =>
      apiClient.post(`/cotizaciones/${cotizacion.id}/convertir`, {
        bodegaId,
        tipoFactura,
        formaPagoId: tipoFactura === 'CONTADO' ? formaPagoId || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo convertir la cotización en factura.')),
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
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opción de pago</label>
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
