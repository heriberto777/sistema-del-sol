import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { EtapaPipeline } from '../../../types/crm';

export function ModalFormEtapaPipeline({ etapa, onClose }: { etapa: EtapaPipeline | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(etapa?.nombre ?? '');
  const [orden, setOrden] = useState(String(etapa?.orden ?? 0));
  const [probabilidadDefault, setProbabilidadDefault] = useState(String(etapa?.probabilidadDefault ?? 0));
  const [color, setColor] = useState(etapa?.color ?? '#c2660c');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      const data = { nombre, orden: Number(orden), probabilidadDefault: Number(probabilidadDefault), color };
      return etapa ? apiClient.patch(`/crm/etapas-pipeline/${etapa.id}`, data) : apiClient.post('/crm/etapas-pipeline', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-etapas-pipeline'] });
      onClose();
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

  return (
    <Modal titulo={etapa ? `Editar etapa — ${etapa.nombre}` : 'Nueva etapa'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField id="etapa-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <FormField id="etapa-orden" label="Orden" type="number" min={0} value={orden} onChange={(e) => setOrden(e.target.value)} required />
          <FormField id="etapa-prob" label="Probabilidad default (%)" type="number" min={0} max={100} value={probabilidadDefault} onChange={(e) => setProbabilidadDefault(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <FormField id="etapa-color" label="Color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" />
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
