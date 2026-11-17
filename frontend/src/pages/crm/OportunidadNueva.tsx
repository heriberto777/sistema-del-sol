import { FormEvent, useState } from 'react';
import { User, UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { useHayCambios } from '../../hooks/useHayCambios';
import { PaginaResultado } from '../../types/pagina-resultado';
import { EtapaPipeline, Lead } from '../../types/crm';

type Referencia = { id: string; nombre: string };

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalFormOportunidad (solo "Nueva oportunidad") de CrmPipelinePanel.tsx.
 */
export function OportunidadNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<'cliente' | 'lead'>('cliente');
  const [referencia, setReferencia] = useState<Referencia | null>(null);
  const [titulo, setTitulo] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [montoEstimado, setMontoEstimado] = useState('');
  const [fechaCierreEstimada, setFechaCierreEstimada] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: etapas } = useQuery({
    queryKey: ['crm-etapas-pipeline'],
    queryFn: async () => (await apiClient.get<EtapaPipeline[]>('/crm/etapas-pipeline')).data,
  });
  const etapasOrdenadas = [...(etapas ?? [])].sort((a, b) => a.orden - b.orden);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/crm/oportunidades', {
        titulo,
        etapaId: etapaId || etapasOrdenadas[0]?.id,
        montoEstimado: Number(montoEstimado),
        fechaCierreEstimada,
        ...(modo === 'cliente' ? { clienteId: referencia?.id } : { leadId: referencia?.id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      confirmarGuardado();
      setTimeout(() => navigate('/crm/pipeline'), 0);
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

  const [haycambios, confirmarGuardado] = useHayCambios({ referencia, titulo, etapaId, montoEstimado, fechaCierreEstimada });

  return (
    <PaginaDocumento
      titulo="Nueva oportunidad"
      rutaVolver="/crm/pipeline"
      etiquetaVolver="Volver al Pipeline"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{modo === 'cliente' ? 'Cliente' : 'Lead'}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{referencia?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto estimado</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {Number(montoEstimado || 0).toLocaleString('es-DO')}</span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-oportunidad" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear oportunidad'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/crm/pipeline')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-oportunidad" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Cliente o lead">
          <div className="sm:col-span-2 space-y-3">
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
          </div>
        </Card>

        <Card titulo="Datos de la oportunidad">
          <div className="sm:col-span-2">
            <FormField id="op-titulo" label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ej. Renovación anual" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Etapa</label>
            <select
              value={etapaId || etapasOrdenadas[0]?.id || ''}
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
    </PaginaDocumento>
  );
}
