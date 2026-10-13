import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Badge } from '../../atoms/Badge/Badge';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import type { ClienteBasico } from '@backend-src/common/prisma/cliente-select-basico';
import type { OfertaVisibleProducto } from '../../../lib/formatear-oferta';
import { ModalDetalleCotizacion } from './ModalDetalleCotizacion';
import { ModalConvertirCotizacion } from './ModalConvertirCotizacion';

// Solo id/nombre — es lo único que las páginas de Nueva/Editar cotización
// leen de Cliente (combobox de búsqueda + preselección al editar).
// `ClienteBasico` sigue siendo la fuente real; acotarlo acá con Pick evita
// forzar campos que nunca se usan. Exportado — lo comparten
// CotizacionNueva/CotizacionEditar (frontend/src/pages), páginas en vez de
// modales desde el Modelo B de la exploración "modal o página".
export type Cliente = Pick<ClienteBasico, 'id' | 'nombre'>;

export interface Producto {
  id: string;
  nombre: string;
  codigo: string;
}

export type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA';

export interface LineaCotizacion {
  productoId: string | null;
  varianteId: string | null;
  descripcionManual?: string | null;
  cantidad: string;
  precioUnitario: string;
  montoTotal?: string;
  /** Tasa real guardada en esta línea — 0 si el toggle de ITBIS estaba apagado al crearla/guardarla. */
  porcentajeItbis?: string;
  producto?: { nombre: string; codigo: string };
}

export interface Cotizacion {
  id: string;
  numero: string;
  estado: EstadoCotizacion;
  // Derivado por el backend (fechaVigenciaHasta ya pasó) — nunca pisa
  // `estado`, así que las acciones disponibles (Editar/Enviar/Aceptar/
  // Rechazar) siguen siendo las del estado real: una cotización vencida
  // sigue siendo operable hasta que el cliente la apruebe o la rechace.
  vencida: boolean;
  total: string;
  subtotal?: string;
  descuento?: string;
  itbis?: string;
  createdAt?: string;
  fechaVigenciaHasta: string;
  facturaId: string | null;
  clienteId: string;
  cliente: ClienteBasico;
  lineas: LineaCotizacion[];
}

export const TONO_POR_ESTADO: Record<EstadoCotizacion, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  BORRADOR: 'neutro',
  ENVIADA: 'advertencia',
  ACEPTADA: 'exito',
  RECHAZADA: 'peligro',
};

/** "Vencida" es un aviso sobre el estado real, no un estado aparte — se muestra encima, pero nunca reemplaza las acciones que corresponden a BORRADOR/ENVIADA. */
export function tonoYEtiquetaEstado(cotizacion: Pick<Cotizacion, 'estado' | 'vencida'>): { tono: 'exito' | 'advertencia' | 'peligro' | 'neutro'; etiqueta: string } {
  if (cotizacion.vencida) return { tono: 'peligro', etiqueta: 'VENCIDA' };
  return { tono: TONO_POR_ESTADO[cotizacion.estado], etiqueta: cotizacion.estado };
}

export type LineaForm = {
  productoId: string;
  varianteId: string;
  cantidad: string;
  // Ítem B-9 — línea manual/libre sin producto del catálogo.
  esManual: boolean;
  descripcionManual: string;
  precioUnitario: string;
  /** Precio de lista GENERAL del producto elegido — solo para el subtotal estimado del panel lateral, nunca se envía al backend. */
  precioReferencia?: string | null;
  /** % de ITBIS del producto elegido — junto con `precioReferencia`, solo para estimar el ITBIS del panel lateral, nunca se envía al backend. */
  itbisReferencia?: string | number | null;
  /** Oferta automática vigente del producto elegido — solo para la insignia de la fila, nunca se envía al backend. */
  oferta?: OfertaVisibleProducto | null;
  /** Toggle de ITBIS por línea, mismo criterio que Facturación — ausente/true = aplica, false = exenta en esta línea puntual. */
  aplicaItbis?: boolean;
};

export const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '', aplicaItbis: true };

export function CotizacionesPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const [cotizacionConvirtiendo, setCotizacionConvirtiendo] = useState<Cotizacion | null>(null);
  const [cotizacionImprimiendo, setCotizacionImprimiendo] = useState<Cotizacion | null>(null);
  const [cotizacionViendo, setCotizacionViendo] = useState<Cotizacion | null>(null);

  const { data } = useQuery({
    queryKey: ['cotizaciones', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Cotizacion>>('/cotizaciones', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const [avisoNotificacion, setAvisoNotificacion] = useState<string | null>(null);

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' }) =>
      apiClient.patch<{ avisoNotificacion?: string }>(`/cotizaciones/${id}/estado`, { estado }),
    onSuccess: (respuesta) => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      setAvisoNotificacion(respuesta.data.avisoNotificacion ?? null);
    },
  });

  return (
    <div className="space-y-4">
      {avisoNotificacion && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <p>{avisoNotificacion}</p>
          <div className="flex shrink-0 items-center gap-3">
            <button className="font-medium underline" onClick={() => navigate('/notificaciones')}>
              Ver Notificaciones
            </button>
            <button className="text-amber-600 hover:text-amber-800 dark:text-amber-400" onClick={() => setAvisoNotificacion(null)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        </div>
      )}
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
            {tienePermiso('cotizaciones.crear') && <Button onClick={() => navigate('/cotizaciones/nueva')}>Nueva cotización</Button>}
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
                // Decisión explícita del usuario: editable/enviable/aceptar/rechazar en
                // CUALQUIER estado (incluida una rechazada o vencida — "vencida" ni
                // siquiera es un estado real, ver tonoYEtiquetaEstado) salvo ACEPTADA,
                // que ya cerró la negociación y solo admite convertirse en factura.
                const puedeEditarse = tienePermiso('cotizaciones.editar') && cotizacion.estado !== 'ACEPTADA';
                const acciones = [
                  { etiqueta: 'Imprimir', onClick: () => setCotizacionImprimiendo(cotizacion) },
                  ...(puedeEditarse
                    ? [{ etiqueta: 'Editar', onClick: () => navigate(`/cotizaciones/${cotizacion.id}/editar`) }]
                    : []),
                  ...(puedeEditarse
                    ? [
                        {
                          etiqueta: cotizacion.estado === 'BORRADOR' ? 'Enviar' : 'Reenviar',
                          onClick: () => cambiarEstado.mutate({ id: cotizacion.id, estado: 'ENVIADA' }),
                        },
                      ]
                    : []),
                  ...(puedeEditarse ? [{ etiqueta: 'Aceptar', onClick: () => cambiarEstado.mutate({ id: cotizacion.id, estado: 'ACEPTADA' }) }] : []),
                  ...(puedeEditarse && cotizacion.estado !== 'RECHAZADA'
                    ? [{ etiqueta: 'Rechazar', onClick: () => cambiarEstado.mutate({ id: cotizacion.id, estado: 'RECHAZADA' }), tono: 'peligro' as const }]
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
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{cotizacion.numero}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{cotizacion.cliente?.nombre}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(cotizacion.total).toLocaleString('es-DO')}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(cotizacion.fechaVigenciaHasta).toLocaleDateString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={tonoYEtiquetaEstado(cotizacion).tono}>{tonoYEtiquetaEstado(cotizacion).etiqueta}</Badge>
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
