import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { useAuth } from '../../../hooks/useAuth';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { EtapaPipeline } from '../../../types/crm';
import { ModalFormEtapaPipeline } from './ModalFormEtapaPipeline';

export function CrmEtapasPipelinePanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [editando, setEditando] = useState<EtapaPipeline | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const { data: etapas } = useQuery({
    queryKey: ['crm-etapas-pipeline'],
    queryFn: async () => (await apiClient.get<EtapaPipeline[]>('/crm/etapas-pipeline')).data,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/crm/etapas-pipeline/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-etapas-pipeline'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar la etapa.')),
  });

  const puedeConfigurar = tienePermiso('crm.pipeline.configurar');

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">{error}</div>
      )}
      <Card
        sinPadding
        titulo="Etapas del pipeline"
        descripcion="El orden acá define las columnas del tablero de Pipeline."
        acciones={puedeConfigurar ? <Button onClick={() => setEditando(null)}>Nueva etapa</Button> : undefined}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Orden</th>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Probabilidad default</th>
                <th className="px-5 py-3 font-medium">Color</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {etapas
                ?.slice()
                .sort((a, b) => a.orden - b.orden)
                .map((etapa) => (
                  <tr key={etapa.id}>
                    <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-300">{etapa.orden}</td>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{etapa.nombre}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{etapa.probabilidadDefault}%</td>
                    <td className="px-5 py-3">
                      <span className="inline-block h-4 w-4 rounded-full border border-slate-300 align-middle dark:border-slate-700" style={{ backgroundColor: etapa.color }} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {puedeConfigurar && (
                        <RowActionsMenu
                          acciones={[
                            { etiqueta: 'Editar', onClick: () => setEditando(etapa) },
                            { etiqueta: 'Eliminar', onClick: () => eliminar.mutate(etapa.id), tono: 'peligro' as const },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editando !== undefined && <ModalFormEtapaPipeline etapa={editando} onClose={() => setEditando(undefined)} />}
    </div>
  );
}
