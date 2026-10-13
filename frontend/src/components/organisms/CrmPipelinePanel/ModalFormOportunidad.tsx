import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, UserPlus } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { Button } from '../../atoms/Button/Button';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { EtapaPipeline, Lead } from '../../../types/crm';

type Referencia = { id: string; nombre: string };

export function ModalFormOportunidad({ etapas, onClose }: { etapas: EtapaPipeline[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<'cliente' | 'lead'>('cliente');
  const [referencia, setReferencia] = useState<Referencia | null>(null);
  const [titulo, setTitulo] = useState('');
  const [etapaId, setEtapaId] = useState(etapas[0]?.id ?? '');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [fechaCierreEstimada, setFechaCierreEstimada] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/crm/oportunidades', {
        titulo,
        etapaId,
        montoEstimado: Number(montoEstimado),
        fechaCierreEstimada,
        ...(modo === 'cliente' ? { clienteId: referencia?.id } : { leadId: referencia?.id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la oportunidad.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!referencia) {
      setError(modo === 'cliente' ? 'Elegí un cliente.' : 'Elegí un lead.');
      return;
    }
    if (titulo.trim().length < 3) {
      setError('Ingresá un título.');
      return;
    }
    if (!montoEstimado || Number(montoEstimado) <= 0) {
      setError('Ingresá un monto estimado mayor a cero.');
      return;
    }
    if (!fechaCierreEstimada) {
      setError('Elegí una fecha de cierre estimada.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva oportunidad" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setModo('cliente');
              setReferencia(null);
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${modo === 'cliente' ? 'border-sol-500 bg-sol-50 text-sol-700 dark:bg-sol-900/30 dark:text-sol-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'}`}
          >
            Cliente existente
          </button>
          <button
            type="button"
            onClick={() => {
              setModo('lead');
              setReferencia(null);
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${modo === 'lead' ? 'border-sol-500 bg-sol-50 text-sol-700 dark:bg-sol-900/30 dark:text-sol-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'}`}
          >
            Lead (prospecto)
          </button>
        </div>

        {modo === 'cliente' ? (
          <ComboboxBusqueda<Referencia>
            valor={referencia}
            onSeleccionar={setReferencia}
            obtenerId={(c) => c.id}
            obtenerEtiqueta={(c) => c.nombre}
            placeholder="Buscar cliente…"
            icono={<User size={15} />}
            buscar={async (texto) => (await apiClient.get<PaginaResultado<Referencia>>('/clientes', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos}
          />
        ) : (
          <ComboboxBusqueda<Referencia>
            valor={referencia}
            onSeleccionar={setReferencia}
            obtenerId={(l) => l.id}
            obtenerEtiqueta={(l) => l.nombre}
            placeholder="Buscar lead…"
            icono={<UserPlus size={15} />}
            buscar={async (texto) =>
              (await apiClient.get<PaginaResultado<Lead>>('/crm/leads', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos.map((l) => ({
                id: l.id,
                nombre: l.nombre,
              }))
            }
          />
        )}

        <FormField id="op-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ej. Renovación anual" required />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Etapa</label>
          <select
            value={etapaId}
            onChange={(e) => setEtapaId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {etapas.map((etapa) => (
              <option key={etapa.id} value={etapa.id}>
                {etapa.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="op-monto" label="Monto estimado (RD$)" type="number" min={0} step="0.01" value={montoEstimado} onChange={(e) => setMontoEstimado(e.target.value)} required />
          <FormField id="op-fecha" label="Cierre estimado" type="date" value={fechaCierreEstimada} onChange={(e) => setFechaCierreEstimada(e.target.value)} required />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Crear oportunidad'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
