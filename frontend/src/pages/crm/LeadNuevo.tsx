import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { useHayCambios } from '../../hooks/useHayCambios';
import { ETIQUETA_ORIGEN_LEAD, Lead, OrigenLead } from '../../types/crm';

/**
 * Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal
 * ModalFormLead (modo crear) de CrmLeadsPanel.tsx. ModalFormLead en sí se
 * mantiene intacto para el alta rápida con prefill desde la Bandeja de
 * WhatsApp (ConversacionWhatsapp.tsx) — esa sigue siendo modal a propósito.
 */
export function LeadNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [origen, setOrigen] = useState<OrigenLead>('MANUAL');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      const data = { nombre, email: email || undefined, telefono: telefono || undefined, origen, notas: notas || undefined };
      return apiClient.post<Lead>('/crm/leads', data);
    },
    onSuccess: ({ data: lead }) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      confirmarGuardado();
      navigate(`/crm/leads/${lead.id}`);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el lead.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2) {
      setError('Ingresá un nombre.');
      return;
    }
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ nombre, email, telefono, origen, notas });

  return (
    <PaginaDocumento
      titulo="Nuevo lead"
      rutaVolver="/crm/leads"
      etiquetaVolver="Volver a Leads"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{nombre || 'Sin nombre'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-lead" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/crm/leads')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-lead" onSubmit={onSubmit} className="space-y-4">
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
    </PaginaDocumento>
  );
}
