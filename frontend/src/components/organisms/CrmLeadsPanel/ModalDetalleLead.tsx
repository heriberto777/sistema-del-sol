import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { ActividadesCrmPanel } from '../ActividadesCrmPanel/ActividadesCrmPanel';
import { ModalTimelineCliente } from '../ModalTimelineCliente/ModalTimelineCliente';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { useAuth } from '../../../hooks/useAuth';
import { EstadoLead, ETIQUETA_ESTADO_LEAD, ETIQUETA_ORIGEN_LEAD, Lead, TONO_ESTADO_LEAD } from '../../../types/crm';

const SIGUIENTES_ESTADO: Record<EstadoLead, EstadoLead[]> = {
  NUEVO: ['CONTACTADO', 'DESCARTADO'],
  CONTACTADO: ['CALIFICADO', 'DESCARTADO'],
  CALIFICADO: ['DESCARTADO'],
  DESCARTADO: ['NUEVO', 'CONTACTADO'],
  CONVERTIDO: [],
};

export function ModalDetalleLead({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [tipoCliente, setTipoCliente] = useState<'PERSONA_FISICA' | 'PERSONA_JURIDICA'>('PERSONA_FISICA');
  const [rncCedula, setRncCedula] = useState('');
  const [viendoTimeline, setViendoTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarEstado = useMutation({
    mutationFn: async (estado: EstadoLead) => apiClient.patch(`/crm/leads/${lead.id}/estado`, { estado, motivoDescarte: motivo || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      setPidiendoMotivo(false);
      setMotivo('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado.')),
  });

  const convertir = useMutation({
    mutationFn: async () => apiClient.post(`/crm/leads/${lead.id}/convertir`, { tipo: tipoCliente, rncCedula: rncCedula || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      setConvirtiendo(false);
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo convertir el lead en cliente.')),
  });

  function pedirCambio(estado: EstadoLead) {
    setError(null);
    if (estado === 'DESCARTADO') {
      setPidiendoMotivo(true);
      return;
    }
    cambiarEstado.mutate(estado);
  }

  return (
    <Modal titulo={lead.nombre} onClose={onClose} ancho="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tono={TONO_ESTADO_LEAD[lead.estado]}>{ETIQUETA_ESTADO_LEAD[lead.estado]}</Badge>
            <span className="text-xs text-slate-400">Origen: {ETIQUETA_ORIGEN_LEAD[lead.origen]}</span>
            {lead.vendedor && <span className="text-xs text-slate-400">· Vendedor: {lead.vendedor.nombre}</span>}
          </div>
          {lead.clienteId && (
            <button type="button" onClick={() => setViendoTimeline(true)} className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400">
              Ver timeline del cliente
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</span>
            <p className="text-slate-700 dark:text-slate-300">{lead.email ?? '—'}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Teléfono</span>
            <p className="text-slate-700 dark:text-slate-300">{lead.telefono ?? '—'}</p>
          </div>
        </div>

        {lead.notas && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Notas</span>
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{lead.notas}</p>
          </div>
        )}

        {lead.estado === 'DESCARTADO' && lead.motivoDescarte && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
            Descartado: {lead.motivoDescarte}
          </div>
        )}

        {lead.estado === 'CONVERTIDO' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400">
            Este lead ya es un cliente — revisá el historial completo en el timeline.
          </div>
        )}

        {lead.estado !== 'CONVERTIDO' && tienePermiso('crm.leads.convertir') && (
          <div className="space-y-2 rounded-lg border border-sol-200 bg-sol-50 p-3 dark:border-sol-900 dark:bg-sol-900/10">
            {!convirtiendo ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-sol-800 dark:text-sol-300">¿Este prospecto ya es un cliente real?</p>
                <Button variante="secundario" onClick={() => setConvirtiendo(true)}>
                  Convertir en cliente
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={tipoCliente}
                    onChange={(e) => setTipoCliente(e.target.value as 'PERSONA_FISICA' | 'PERSONA_JURIDICA')}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="PERSONA_FISICA">Persona física</option>
                    <option value="PERSONA_JURIDICA">Persona jurídica</option>
                  </select>
                  <input
                    type="text"
                    value={rncCedula}
                    onChange={(e) => setRncCedula(e.target.value)}
                    placeholder="RNC/Cédula (opcional)"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variante="secundario" onClick={() => setConvirtiendo(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={convertir.isPending} onClick={() => convertir.mutate()}>
                    {convertir.isPending ? 'Convirtiendo…' : 'Confirmar conversión'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {SIGUIENTES_ESTADO[lead.estado].length > 0 && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            {!pidiendoMotivo ? (
              <div className="flex flex-wrap gap-2">
                {SIGUIENTES_ESTADO[lead.estado].map((estado) => (
                  <Button
                    key={estado}
                    variante={estado === 'DESCARTADO' ? 'peligro' : 'secundario'}
                    disabled={cambiarEstado.isPending}
                    onClick={() => pedirCambio(estado)}
                  >
                    {estado === 'DESCARTADO' ? 'Descartar' : `Pasar a ${ETIQUETA_ESTADO_LEAD[estado]}`}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="¿Por qué se descarta?"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="flex justify-end gap-2">
                  <Button variante="secundario" onClick={() => setPidiendoMotivo(false)}>
                    Cancelar
                  </Button>
                  <Button variante="peligro" disabled={cambiarEstado.isPending || motivo.trim().length < 3} onClick={() => cambiarEstado.mutate('DESCARTADO')}>
                    Confirmar descarte
                  </Button>
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Actividades</h3>
          <ActividadesCrmPanel referencia={{ leadId: lead.id }} />
        </div>
      </div>

      {viendoTimeline && lead.clienteId && (
        <ModalTimelineCliente clienteId={lead.clienteId} nombreCliente={lead.nombre} onClose={() => setViendoTimeline(false)} />
      )}
    </Modal>
  );
}
