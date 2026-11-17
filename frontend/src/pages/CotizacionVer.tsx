import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { ModalImprimir } from '../components/molecules/ModalImprimir/ModalImprimir';
import { TablaArticulosDocumento } from '../components/molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { BloqueTotalesDocumento } from '../components/molecules/BloqueTotalesDocumento/BloqueTotalesDocumento';
import { PanelComentariosDocumento } from '../components/organisms/PanelComentariosDocumento/PanelComentariosDocumento';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { Cotizacion, tonoYEtiquetaEstado } from '../components/organisms/CotizacionesPanel/CotizacionesPanel';
import { ModalConvertirCotizacion } from '../components/organisms/CotizacionesPanel/ModalConvertirCotizacion';

/**
 * Auditoría UX (post Período Contable, 2026-11) — reemplaza a
 * `ModalDetalleCotizacion`: mismas acciones que antes vivían en el menú
 * de la fila (Editar/Enviar/Aceptar/Rechazar/Convertir en factura), ahora
 * en el panel lateral, siempre visibles.
 */
export function CotizacionVer() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [imprimiendo, setImprimiendo] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [avisoNotificacion, setAvisoNotificacion] = useState<string | null>(null);

  const { data: cotizacion } = useQuery({
    queryKey: ['cotizacion-detalle', id],
    queryFn: async () => (await apiClient.get<Cotizacion>(`/cotizaciones/${id}`)).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async (estado: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA') =>
      apiClient.patch<{ avisoNotificacion?: string }>(`/cotizaciones/${id}/estado`, { estado }),
    onSuccess: (respuesta) => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['cotizacion-detalle', id] });
      setAvisoNotificacion(respuesta.data.avisoNotificacion ?? null);
    },
  });

  const puedeEditarse = !!cotizacion && tienePermiso('cotizaciones.editar') && cotizacion.estado !== 'ACEPTADA';
  const puedeConvertir =
    !!cotizacion && tienePermiso('cotizaciones.editar') && cotizacion.estado === 'ACEPTADA' && !cotizacion.facturaId;

  return (
    <RequierePermiso permiso="cotizaciones.ver">
      <PaginaDocumento
        titulo={cotizacion ? `Cotización ${cotizacion.numero}` : 'Cotización'}
        rutaVolver="/cotizaciones"
        etiquetaVolver="Volver a Cotizaciones"
        haycambios={false}
        resumen={
          !cotizacion ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
                <Badge tono={tonoYEtiquetaEstado(cotizacion).tono}>{tonoYEtiquetaEstado(cotizacion).etiqueta}</Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cotizacion.cliente?.nombre}</span>
              </div>
              {cotizacion.createdAt && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(cotizacion.createdAt).toLocaleDateString('es-DO')}</span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Válida hasta</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(cotizacion.fechaVigenciaHasta).toLocaleDateString('es-DO')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {Number(cotizacion.total).toLocaleString('es-DO')}</span>
              </div>
              {cotizacion.facturaId && <p className="text-xs text-slate-400">Ya facturada</p>}
            </>
          )
        }
        acciones={
          <>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setImprimiendo(true)}>
              Imprimir / descargar PDF
            </Button>
            {puedeEditarse && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/cotizaciones/${id}/editar`)}>
                Editar
              </Button>
            )}
            {puedeEditarse && (
              <Button type="button" variante="secundario" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('ENVIADA')}>
                {cotizacion?.estado === 'BORRADOR' ? 'Enviar' : 'Reenviar'}
              </Button>
            )}
            {puedeEditarse && (
              <Button type="button" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('ACEPTADA')}>
                Aceptar
              </Button>
            )}
            {puedeEditarse && cotizacion?.estado !== 'RECHAZADA' && (
              <Button type="button" variante="peligro" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('RECHAZADA')}>
                Rechazar
              </Button>
            )}
            {puedeConvertir && (
              <Button type="button" className="w-full" onClick={() => setConvirtiendo(true)}>
                Convertir en factura
              </Button>
            )}
          </>
        }
      >
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

        {!cotizacion ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <>
            {cotizacion.observaciones && (
              <Card titulo="Observaciones">
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{cotizacion.observaciones}</p>
              </Card>
            )}
            <TablaArticulosDocumento lineas={cotizacion.lineas} />
            <BloqueTotalesDocumento
              subtotal={cotizacion.subtotal ?? 0}
              descuento={cotizacion.descuento}
              itbis={cotizacion.itbis ?? 0}
              total={cotizacion.total}
            />
            <PanelComentariosDocumento tipoDocumento="COTIZACION" documentoId={cotizacion.id} />
          </>
        )}
      </PaginaDocumento>

      {imprimiendo && cotizacion && (
        <ModalImprimir urlBase={`/cotizaciones/${cotizacion.id}`} titulo={`Imprimir — ${cotizacion.numero}`} onClose={() => setImprimiendo(false)} />
      )}
      {convirtiendo && cotizacion && <ModalConvertirCotizacion cotizacion={cotizacion} onClose={() => setConvirtiendo(false)} />}
    </RequierePermiso>
  );
}
