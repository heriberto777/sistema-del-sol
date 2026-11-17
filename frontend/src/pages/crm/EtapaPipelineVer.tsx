import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { useHayCambios } from '../../hooks/useHayCambios';
import { EtapaPipeline } from '../../types/crm';

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalFormEtapaPipeline de CrmEtapasPipelinePanel.tsx. */
export function EtapaPipelineVer() {
  const { id } = useParams<{ id: string }>();
  const esNueva = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: etapas } = useQuery({
    queryKey: ['crm-etapas-pipeline'],
    queryFn: async () => (await apiClient.get<EtapaPipeline[]>('/crm/etapas-pipeline')).data,
  });
  const etapa = esNueva ? null : etapas?.find((e) => e.id === id);

  const [nombre, setNombre] = useState('');
  const [orden, setOrden] = useState('0');
  const [probabilidadDefault, setProbabilidadDefault] = useState('0');
  const [color, setColor] = useState('#c2660c');
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (etapa && !cargado) {
      setNombre(etapa.nombre);
      setOrden(String(etapa.orden));
      setProbabilidadDefault(String(etapa.probabilidadDefault));
      setColor(etapa.color);
      setCargado(true);
    }
  }, [etapa, cargado]);

  const guardar = useMutation({
    mutationFn: async () => {
      const data = { nombre, orden: Number(orden), probabilidadDefault: Number(probabilidadDefault), color };
      return esNueva ? apiClient.post('/crm/etapas-pipeline', data) : apiClient.patch(`/crm/etapas-pipeline/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-etapas-pipeline'] });
      confirmarGuardado();
      navigate('/crm/etapas-pipeline');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la etapa.')),
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

  const [haycambios, confirmarGuardado] = useHayCambios({ nombre, orden, probabilidadDefault, color }, esNueva || cargado);

  return (
    <PaginaDocumento
      titulo={esNueva ? 'Nueva etapa' : etapa ? `Etapa — ${etapa.nombre}` : 'Etapa del pipeline'}
      rutaVolver="/crm/etapas-pipeline"
      etiquetaVolver="Volver a Etapas del pipeline"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</span>
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span className="inline-block h-4 w-4 rounded-full border border-slate-300 dark:border-slate-700" style={{ backgroundColor: color }} />
            {nombre || 'Sin nombre'}
          </span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-etapa-pipeline" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/crm/etapas-pipeline')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-etapa-pipeline" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información de la etapa">
          <div className="sm:col-span-2">
            <FormField id="etapa-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <FormField id="etapa-orden" label="Orden" type="number" min={0} value={orden} onChange={(e) => setOrden(e.target.value)} required />
          <FormField
            id="etapa-prob"
            label="Probabilidad default (%)"
            type="number"
            min={0}
            max={100}
            value={probabilidadDefault}
            onChange={(e) => setProbabilidadDefault(e.target.value)}
          />
          <FormField id="etapa-color" label="Color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
