import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { useAuth } from '../../../hooks/useAuth';
import { EtapaPipeline, Oportunidad } from '../../../types/crm';
import { ModalFormOportunidad } from './ModalFormOportunidad';
import { ModalCerrarOportunidad } from './ModalCerrarOportunidad';
import { ModalDetalleOportunidad } from './ModalDetalleOportunidad';

interface PipelineResponse {
  abiertas: Oportunidad[];
  ganadasRecientes: Oportunidad[];
  perdidasRecientes: Oportunidad[];
}

function TarjetaOportunidad({
  oportunidad,
  etapas,
  onVerDetalle,
  onCerrar,
}: {
  oportunidad: Oportunidad;
  etapas: EtapaPipeline[];
  onVerDetalle: () => void;
  onCerrar: (estado: 'GANADA' | 'PERDIDA') => void;
}) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();

  const moverEtapa = useMutation({
    mutationFn: async (etapaId: string) => apiClient.patch(`/crm/oportunidades/${oportunidad.id}/etapa`, { etapaId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }),
  });

  const eliminar = useMutation({
    mutationFn: async () => apiClient.delete(`/crm/oportunidades/${oportunidad.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }),
  });

  const puedeEditar = tienePermiso('crm.oportunidades.editar') && oportunidad.estado === 'ABIERTA';
  const acciones = [
    { etiqueta: 'Ver detalle', onClick: onVerDetalle },
    ...(puedeEditar
      ? etapas.filter((e) => e.id !== oportunidad.etapaId).map((e) => ({ etiqueta: `Mover a: ${e.nombre}`, onClick: () => moverEtapa.mutate(e.id) }))
      : []),
    ...(puedeEditar ? [{ etiqueta: 'Marcar ganada', onClick: () => onCerrar('GANADA') }] : []),
    ...(puedeEditar ? [{ etiqueta: 'Marcar perdida', onClick: () => onCerrar('PERDIDA'), tono: 'peligro' as const }] : []),
    ...(tienePermiso('crm.oportunidades.eliminar') && !oportunidad.cotizacionId
      ? [{ etiqueta: 'Eliminar', onClick: () => eliminar.mutate(), tono: 'peligro' as const }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-1">
        <button type="button" onClick={onVerDetalle} className="text-left font-semibold text-slate-900 hover:underline dark:text-slate-100">
          {oportunidad.titulo}
        </button>
        <RowActionsMenu acciones={acciones} />
      </div>
      <span className="font-mono text-slate-600 dark:text-slate-400">RD$ {Number(oportunidad.montoEstimado).toLocaleString('es-DO')}</span>
      <span className="text-[11px] text-slate-400">
        {oportunidad.cliente?.nombre ?? oportunidad.lead?.nombre ?? 'Sin asignar'} · {oportunidad.vendedor.nombre}
      </span>
      {oportunidad.estado === 'PERDIDA' && oportunidad.motivoPerdida && <span className="text-[11px] text-red-500">{oportunidad.motivoPerdida}</span>}
      {oportunidad.cotizacionId && <span className="text-[11px] text-sol-600 dark:text-sol-400">→ Cotización generada</span>}
    </div>
  );
}

export function CrmPipelinePanel() {
  const { tienePermiso } = useAuth();
  const [creando, setCreando] = useState(false);
  const [viendo, setViendo] = useState<Oportunidad | null>(null);
  const [cerrando, setCerrando] = useState<{ oportunidad: Oportunidad; estado: 'GANADA' | 'PERDIDA' } | null>(null);

  const { data: etapas } = useQuery({
    queryKey: ['crm-etapas-pipeline'],
    queryFn: async () => (await apiClient.get<EtapaPipeline[]>('/crm/etapas-pipeline')).data,
  });

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: async () => (await apiClient.get<PipelineResponse>('/crm/oportunidades/pipeline')).data,
    enabled: !!etapas,
  });

  const etapasOrdenadas = [...(etapas ?? [])].sort((a, b) => a.orden - b.orden);
  const sinPipeline = !isLoading && pipeline && pipeline.abiertas.length === 0 && pipeline.ganadasRecientes.length === 0 && pipeline.perdidasRecientes.length === 0;

  return (
    <div className="space-y-4">
      <Card
        titulo="Pipeline"
        descripcion="Oportunidades abiertas por etapa — últimas ganadas/perdidas de los últimos 30 días."
        acciones={tienePermiso('crm.oportunidades.crear') && etapasOrdenadas.length > 0 ? <Button onClick={() => setCreando(true)}>Nueva oportunidad</Button> : undefined}
      >
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {etapasOrdenadas.length === 0 && !isLoading && (
          <EstadoVacio titulo="Sin etapas configuradas" descripcion="Configurá al menos una etapa del pipeline en Etapas del pipeline." />
        )}
        {sinPipeline && <EstadoVacio titulo="Pipeline vacío" descripcion="Todavía no hay oportunidades — creá la primera." />}

        {!isLoading && pipeline && etapasOrdenadas.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {etapasOrdenadas.map((etapa) => {
              const oportunidades = pipeline.abiertas.filter((o) => o.etapaId === etapa.id);
              return (
                <div key={etapa.id} className="flex w-60 shrink-0 flex-col gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold" style={{ color: etapa.color }}>
                      {etapa.nombre}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{oportunidades.length}</span>
                  </div>
                  {oportunidades.map((o) => (
                    <TarjetaOportunidad key={o.id} oportunidad={o} etapas={etapasOrdenadas} onVerDetalle={() => setViendo(o)} onCerrar={(estado) => setCerrando({ oportunidad: o, estado })} />
                  ))}
                </div>
              );
            })}

            <div className="flex w-60 shrink-0 flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-900 dark:bg-emerald-900/10">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ganada</span>
                <span className="font-mono text-[11px] text-slate-400">{pipeline.ganadasRecientes.length}</span>
              </div>
              {pipeline.ganadasRecientes.map((o) => (
                <TarjetaOportunidad key={o.id} oportunidad={o} etapas={etapasOrdenadas} onVerDetalle={() => setViendo(o)} onCerrar={() => {}} />
              ))}
            </div>

            <div className="flex w-60 shrink-0 flex-col gap-2 rounded-lg border border-red-200 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-900/10">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">Perdida</span>
                <span className="font-mono text-[11px] text-slate-400">{pipeline.perdidasRecientes.length}</span>
              </div>
              {pipeline.perdidasRecientes.map((o) => (
                <TarjetaOportunidad key={o.id} oportunidad={o} etapas={etapasOrdenadas} onVerDetalle={() => setViendo(o)} onCerrar={() => {}} />
              ))}
            </div>
          </div>
        )}
      </Card>

      {creando && <ModalFormOportunidad etapas={etapasOrdenadas} onClose={() => setCreando(false)} />}
      {viendo && <ModalDetalleOportunidad oportunidad={viendo} onClose={() => setViendo(null)} />}
      {cerrando && <ModalCerrarOportunidad oportunidad={cerrando.oportunidad} estado={cerrando.estado} onClose={() => setCerrando(null)} />}
    </div>
  );
}
