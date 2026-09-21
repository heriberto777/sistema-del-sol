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

export type EstadoCotizacion = 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA';

export interface LineaCotizacion {
  productoId: string | null;
  varianteId: string | null;
  descripcionManual?: string | null;
  cantidad: string;
  precioUnitario: string;
  montoTotal?: string;
  producto?: { nombre: string; codigo: string };
}

export interface Cotizacion {
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
  cliente: ClienteBasico;
  lineas: LineaCotizacion[];
}

export const TONO_POR_ESTADO: Record<EstadoCotizacion, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  BORRADOR: 'neutro',
  ENVIADA: 'advertencia',
  ACEPTADA: 'exito',
  RECHAZADA: 'peligro',
  VENCIDA: 'peligro',
};

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
};

export const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '' };

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
                const acciones = [
                  { etiqueta: 'Imprimir', onClick: () => setCotizacionImprimiendo(cotizacion) },
                  ...(tienePermiso('cotizaciones.editar') && cotizacion.estado === 'BORRADOR'
                    ? [{ etiqueta: 'Editar', onClick: () => navigate(`/cotizaciones/${cotizacion.id}/editar`) }]
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
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{cotizacion.numero}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{cotizacion.cliente?.nombre}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(cotizacion.total).toLocaleString('es-DO')}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(cotizacion.fechaVigenciaHasta).toLocaleDateString('es-DO')}</td>
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
