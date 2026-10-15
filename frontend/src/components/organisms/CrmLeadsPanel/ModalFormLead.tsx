import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { ETIQUETA_ORIGEN_LEAD, Lead, OrigenLead } from '../../../types/crm';

/** Solo se usa cuando `lead` es `null` (alta nueva) — ej. "Crear Lead" desde la Bandeja de WhatsApp, que ya conoce el teléfono y el origen. */
interface PrefillLead {
  nombre?: string;
  telefono?: string;
  origen?: OrigenLead;
}

export function ModalFormLead({
  lead,
  onClose,
  prefill,
  onCreado,
}: {
  lead: Lead | null;
  onClose: () => void;
  prefill?: PrefillLead;
  /** Llamado con el lead recién creado (no en edición) — ej. para que la Bandeja de WhatsApp refresque el badge Cliente/Lead sin esperar el refetchInterval. */
  onCreado?: (lead: Lead) => void;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(lead?.nombre ?? prefill?.nombre ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [telefono, setTelefono] = useState(lead?.telefono ?? prefill?.telefono ?? '');
  const [origen, setOrigen] = useState<OrigenLead>(lead?.origen ?? prefill?.origen ?? 'MANUAL');
  const [notas, setNotas] = useState(lead?.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      const data = { nombre, email: email || undefined, telefono: telefono || undefined, origen, notas: notas || undefined };
      return lead ? apiClient.patch<Lead>(`/crm/leads/${lead.id}`, data) : apiClient.post<Lead>('/crm/leads', data);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      if (!lead) onCreado?.(res.data);
      onClose();
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

  return (
    <Modal titulo={lead ? `Editar lead — ${lead.nombre}` : 'Nuevo lead'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField id="lead-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <FormField id="lead-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormField id="lead-telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
