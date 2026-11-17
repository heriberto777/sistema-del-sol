import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Badge } from '../../components/atoms/Badge/Badge';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ActividadesCrmPanel } from '../../components/organisms/ActividadesCrmPanel/ActividadesCrmPanel';
import { TimelineClientePanel } from '../../components/organisms/TimelineClientePanel/TimelineClientePanel';
import { useHayCambios } from '../../hooks/useHayCambios';
import { useAuth } from '../../hooks/useAuth';
import { EtapaPipeline, ETIQUETA_ESTADO_COTIZACION_CRM, Oportunidad } from '../../types/crm';

const TONO_ESTADO: Record<Oportunidad['estado'], 'neutro' | 'exito' | 'peligro'> = { ABIERTA: 'neutro', GANADA: 'exito', PERDIDA: 'peligro' };
const TONO_ESTADO_COTIZACION: Record<string, 'neutro' | 'exito' | 'peligro' | 'advertencia'> = {
  BORRADOR: 'neutro',
  ENVIADA: 'advertencia',
  ACEPTADA: 'exito',
  RECHAZADA: 'peligro',
  VENCIDA: 'peligro',
};

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalDetalleOportunidad + ModalCerrarOportunidad de CrmPipelinePanel.tsx
 * (y la edición de título/monto/etapa/fecha, que el backend ya soportaba
 * vía PATCH pero ningún modal exponía). "Generar cotización" pasa a su
 * propia página (OportunidadGenerarCotizacion) — formulario demasiado
 * grande para un toggle acá.
 */
export function OportunidadVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();

  const { data: oportunidad } = useQuery({
    queryKey: ['crm-oportunidad', id],
    queryFn: async () => (await apiClient.get<Oportunidad>(`/crm/oportunidades/${id}`)).data,
  });
  const { data: etapas } = useQuery({
    queryKey: ['crm-etapas-pipeline'],
    queryFn: async () => (await apiClient.get<EtapaPipeline[]>('/crm/etapas-pipeline')).data,
  });
  const etapasOrdenadas = [...(etapas ?? [])].sort((a, b) => a.orden - b.orden);

  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [fechaCierreEstimada, setFechaCierreEstimada] = useState('');
  const [cargado, setCargado] = useState(false);

  const [viendoTimeline, setViendoTimeline] = useState(false);
  const [cerrando, setCerrando] = useState<'GANADA' | 'PERDIDA' | null>(null);
  const [motivoPerdida, setMotivoPerdida] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (oportunidad && !cargado) {
      setTitulo(oportunidad.titulo);
      setEtapaId(oportunidad.etapaId);
      setMontoEstimado(oportunidad.montoEstimado);
      setFechaCierreEstimada(oportunidad.fechaCierreEstimada.slice(0, 10));
      setCargado(true);
    }
  }, [oportunidad, cargado]);

  const guardar = useMutation({
    mutationFn: async () => apiClient.patch(`/crm/oportunidades/${id}`, { titulo, etapaId, montoEstimado: Number(montoEstimado), fechaCierreEstimada }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['crm-oportunidad', id] });
      confirmarGuardado();
      setEditando(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la oportunidad.')),
  });

  const cerrar = useMutation({
    mutationFn: async (estado: 'GANADA' | 'PERDIDA') =>
      apiClient.patch(`/crm/oportunidades/${id}/cerrar`, { estado, motivoPerdida: motivoPerdida || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['crm-oportunidad', id] });
      setCerrando(null);
      setMotivoPerdida('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cerrar la oportunidad.')),
  });

  function pedirCierre(estado: 'GANADA' | 'PERDIDA') {
    setError(null);
    setCerrando(estado);
  }

  function confirmarCierre() {
    setError(null);
    if (cerrando === 'PERDIDA' && motivoPerdida.trim().length < 3) {
      setError('Indicá un motivo.');
      return;
    }
    cerrar.mutate(cerrando!);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (titulo.trim().length < 3) {
      setError('Ingresá un título.');
      return;
    }
    if (!montoEstimado || Number(montoEstimado) <= 0) {
      setError('Ingresá un monto estimado mayor a cero.');
      return;
    }
    guardar.mutate();
  }

  const [hayCambiosForm, confirmarGuardado] = useHayCambios({ titulo, etapaId, montoEstimado, fechaCierreEstimada }, cargado);
  const haycambios = editando && hayCambiosForm;
  const puedeEditar = oportunidad?.estado === 'ABIERTA' && tienePermiso('crm.oportunidades.editar');
  const puedeGenerarCotizacion = puedeEditar && tienePermiso('crm.oportunidades.convertir') && !oportunidad?.cotizacionId;

  return (
    <PaginaDocumento
      titulo={oportunidad?.titulo ?? 'Oportunidad'}
      rutaVolver="/crm/pipeline"
      etiquetaVolver="Volver al Pipeline"
      haycambios={haycambios}
      resumen={
        oportunidad ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
              <Badge tono={TONO_ESTADO[oportunidad.estado]}>{oportunidad.estado}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Etapa</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {oportunidad.etapa.nombre} · {oportunidad.probabilidadPct}%
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{oportunidad.cliente ? 'Cliente' : 'Lead'}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{oportunidad.cliente?.nombre ?? oportunidad.lead?.nombre ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vendedor</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{oportunidad.vendedor.nombre}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto estimado</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {Number(oportunidad.montoEstimado).toLocaleString('es-DO')}</span>
            </div>
          </>
        ) : null
      }
      acciones={
        editando ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-oportunidad" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </>
        ) : oportunidad ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {puedeEditar && (
              <Button type="button" className="w-full" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            {puedeGenerarCotizacion && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/crm/oportunidades/${id}/generar-cotizacion`)}>
                Generar cotización
              </Button>
            )}
            {puedeEditar && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => pedirCierre('GANADA')}>
                Marcar ganada
              </Button>
            )}
            {puedeEditar && (
              <Button type="button" variante="peligro" className="w-full" onClick={() => pedirCierre('PERDIDA')}>
                Marcar perdida
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/crm/pipeline')}>
              Volver
            </Button>
          </>
        ) : null
      }
    >
      {!oportunidad ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : editando ? (
        <form id="form-oportunidad" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Datos de la oportunidad">
            <div className="sm:col-span-2">
              <FormField id="op-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Etapa</label>
              <select
                value={etapaId}
                onChange={(e) => setEtapaId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {etapasOrdenadas.map((etapa) => (
                  <option key={etapa.id} value={etapa.id}>
                    {etapa.nombre}
                  </option>
                ))}
              </select>
            </div>
            <FormField id="op-monto" label="Monto estimado (RD$)" type="number" min={0} step="0.01" value={montoEstimado} onChange={(e) => setMontoEstimado(e.target.value)} required />
            <FormField id="op-fecha" label="Cierre estimado" type="date" value={fechaCierreEstimada} onChange={(e) => setFechaCierreEstimada(e.target.value)} required />
          </Card>
        </form>
      ) : (
        <div className="space-y-4">
          <Card titulo="Información de la oportunidad">
            <div className="sm:col-span-2 flex items-center justify-between gap-2">
              {oportunidad.clienteId && (
                <button
                  type="button"
                  onClick={() => setViendoTimeline((v) => !v)}
                  className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
                >
                  {viendoTimeline ? 'Ocultar timeline del cliente' : 'Ver timeline del cliente'}
                </button>
              )}
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Cierre estimado</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{new Date(oportunidad.fechaCierreEstimada).toLocaleDateString('es-DO')}</p>
            </div>
            {oportunidad.estado === 'PERDIDA' && oportunidad.motivoPerdida && (
              <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
                Motivo: {oportunidad.motivoPerdida}
              </div>
            )}
            {oportunidad.cotizacion && (
              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-sol-200 bg-sol-50 p-3 text-sm dark:border-sol-900 dark:bg-sol-900/10">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sol-900 dark:text-sol-200">Cotización {oportunidad.cotizacion.numero}</span>
                  <Badge tono={TONO_ESTADO_COTIZACION[oportunidad.cotizacion.estado]}>{ETIQUETA_ESTADO_COTIZACION_CRM[oportunidad.cotizacion.estado]}</Badge>
                  <span className="font-mono text-sol-800 dark:text-sol-300">RD$ {Number(oportunidad.cotizacion.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <Button variante="secundario" onClick={() => navigate('/cotizaciones')}>
                  Ver en Cotizaciones
                </Button>
              </div>
            )}
          </Card>

          {viendoTimeline && oportunidad.clienteId && (
            <Card titulo="Timeline del cliente">
              <div className="sm:col-span-2">
                <TimelineClientePanel clienteId={oportunidad.clienteId} />
              </div>
            </Card>
          )}

          {cerrando && (
            <Card titulo={cerrando === 'GANADA' ? 'Marcar ganada' : 'Marcar perdida'}>
              <div className="sm:col-span-2 space-y-2">
                {cerrando === 'GANADA' ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Cierra la oportunidad como ganada sin generar ningún documento. Si todavía necesitás mandarle una cotización al cliente, usá
                    "Generar cotización" en vez de esto.
                  </p>
                ) : (
                  <textarea
                    value={motivoPerdida}
                    onChange={(e) => setMotivoPerdida(e.target.value)}
                    placeholder="ej. Precio, eligió a la competencia, se enfrió…"
                    rows={2}
                    autoFocus
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variante="secundario" onClick={() => setCerrando(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" variante={cerrando === 'PERDIDA' ? 'peligro' : 'primario'} disabled={cerrar.isPending} onClick={confirmarCierre}>
                    {cerrar.isPending ? 'Guardando…' : cerrando === 'GANADA' ? 'Confirmar ganada' : 'Confirmar perdida'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card titulo="Actividades">
            <div className="sm:col-span-2">
              <ActividadesCrmPanel referencia={{ oportunidadId: oportunidad.id }} />
            </div>
          </Card>
        </div>
      )}
    </PaginaDocumento>
  );
}
