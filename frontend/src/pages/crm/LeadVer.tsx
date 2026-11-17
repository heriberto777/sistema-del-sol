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
import { useAuth } from '../../hooks/useAuth';
import { useHayCambios } from '../../hooks/useHayCambios';
import { EstadoLead, ETIQUETA_ESTADO_LEAD, ETIQUETA_ORIGEN_LEAD, Lead, OrigenLead, TONO_ESTADO_LEAD } from '../../types/crm';

const SIGUIENTES_ESTADO: Record<EstadoLead, EstadoLead[]> = {
  NUEVO: ['CONTACTADO', 'DESCARTADO'],
  CONTACTADO: ['CALIFICADO', 'DESCARTADO'],
  CALIFICADO: ['DESCARTADO'],
  DESCARTADO: ['NUEVO', 'CONTACTADO'],
  CONVERTIDO: [],
};

/**
 * Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal
 * ModalDetalleLead (y la edición de ModalFormLead cuando `lead` no es
 * null) de CrmLeadsPanel.tsx. "Editar" es un toggle inline en esta misma
 * página, no una ruta aparte — el resto del contenido (estado, convertir,
 * actividades, timeline) siempre queda visible.
 */
export function LeadVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();

  const { data: lead } = useQuery({
    queryKey: ['crm-lead', id],
    queryFn: async () => (await apiClient.get<Lead>(`/crm/leads/${id}`)).data,
  });

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [origen, setOrigen] = useState<OrigenLead>('MANUAL');
  const [notas, setNotas] = useState('');
  const [cargado, setCargado] = useState(false);

  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [tipoCliente, setTipoCliente] = useState<'PERSONA_FISICA' | 'PERSONA_JURIDICA'>('PERSONA_FISICA');
  const [rncCedula, setRncCedula] = useState('');
  const [viendoTimeline, setViendoTimeline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lead && !cargado) {
      setNombre(lead.nombre);
      setEmail(lead.email ?? '');
      setTelefono(lead.telefono ?? '');
      setOrigen(lead.origen);
      setNotas(lead.notas ?? '');
      setCargado(true);
    }
  }, [lead, cargado]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch<Lead>(`/crm/leads/${id}`, { nombre, email: email || undefined, telefono: telefono || undefined, origen, notas: notas || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-lead', id] });
      confirmarGuardado();
      setEditando(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el lead.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async (estado: EstadoLead) => apiClient.patch(`/crm/leads/${id}/estado`, { estado, motivoDescarte: motivo || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-lead', id] });
      setPidiendoMotivo(false);
      setMotivo('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado.')),
  });

  const convertir = useMutation({
    mutationFn: async () => apiClient.post(`/crm/leads/${id}/convertir`, { tipo: tipoCliente, rncCedula: rncCedula || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-lead', id] });
      setConvirtiendo(false);
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2) {
      setError('Ingresá un nombre.');
      return;
    }
    guardar.mutate();
  }

  const [hayCambiosForm, confirmarGuardado] = useHayCambios({ nombre, email, telefono, origen, notas }, cargado);
  const haycambios = editando && hayCambiosForm;
  const puedeEditar = lead?.estado !== 'CONVERTIDO' && tienePermiso('crm.leads.editar');

  return (
    <PaginaDocumento
      titulo={lead?.nombre ?? 'Lead'}
      rutaVolver="/crm/leads"
      etiquetaVolver="Volver a Leads"
      haycambios={haycambios}
      resumen={
        lead ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
              <Badge tono={TONO_ESTADO_LEAD[lead.estado]}>{ETIQUETA_ESTADO_LEAD[lead.estado]}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Origen</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ETIQUETA_ORIGEN_LEAD[lead.origen]}</span>
            </div>
            {lead.vendedor && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vendedor</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{lead.vendedor.nombre}</span>
              </div>
            )}
          </>
        ) : null
      }
      acciones={
        editando ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-lead" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            {puedeEditar && (
              <Button type="button" className="w-full" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/crm/leads')}>
              Volver
            </Button>
          </>
        )
      }
    >
      {!lead ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : editando ? (
        <form id="form-lead" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Información del lead">
            <div className="sm:col-span-2">
              <FormField id="lead-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <FormField id="lead-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FormField id="lead-telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Origen</label>
              <select
                value={origen}
                onChange={(e) => setOrigen(e.target.value as OrigenLead)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {Object.entries(ETIQUETA_ORIGEN_LEAD).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </Card>
        </form>
      ) : (
        <div className="space-y-4">
          <Card titulo="Información del lead">
            <div className="sm:col-span-2 flex items-center justify-between gap-2">
              {lead.clienteId && (
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
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{lead.email ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Teléfono</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{lead.telefono ?? '—'}</p>
            </div>
            {lead.notas && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Notas</span>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{lead.notas}</p>
              </div>
            )}
            {lead.estado === 'DESCARTADO' && lead.motivoDescarte && (
              <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
                Descartado: {lead.motivoDescarte}
              </div>
            )}
            {lead.estado === 'CONVERTIDO' && (
              <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400">
                Este lead ya es un cliente — revisá el historial completo en el timeline.
              </div>
            )}
          </Card>

          {viendoTimeline && lead.clienteId && (
            <Card titulo="Timeline del cliente">
              <div className="sm:col-span-2">
                <TimelineClientePanel clienteId={lead.clienteId} />
              </div>
            </Card>
          )}

          {lead.estado !== 'CONVERTIDO' && tienePermiso('crm.leads.convertir') && (
            <Card titulo="Convertir en cliente">
              <div className="sm:col-span-2 space-y-2">
                {!convirtiendo ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-700 dark:text-slate-300">¿Este prospecto ya es un cliente real?</p>
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
            </Card>
          )}

          {SIGUIENTES_ESTADO[lead.estado].length > 0 && (
            <Card titulo="Cambiar estado">
              <div className="sm:col-span-2 space-y-2">
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
            </Card>
          )}

          <Card titulo="Actividades">
            <div className="sm:col-span-2">
              <ActividadesCrmPanel referencia={{ leadId: lead.id }} />
            </div>
          </Card>
        </div>
      )}
    </PaginaDocumento>
  );
}
