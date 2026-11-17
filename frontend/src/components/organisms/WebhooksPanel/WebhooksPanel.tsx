import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';

interface Webhook {
  id: string;
  url: string;
  eventos: string[];
  activo: boolean;
}

export function WebhooksPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => (await apiClient.get<Webhook[]>('/webhooks')).data,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo eliminar el webhook.')),
  });

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {webhooks?.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay webhooks configurados"
          descripcion="Creá uno para que un sistema externo se entere en tiempo real de tus facturas, cobros, etc."
          etiquetaAccion="Nuevo webhook"
          onAccion={() => navigate('/webhooks/nuevo')}
        />
      ) : (
        <Card
          sinPadding
          titulo="Webhooks"
          descripcion="Notifican a una URL externa cuando ocurre un evento del negocio, con firma HMAC para verificar el origen."
          acciones={<Button onClick={() => navigate('/webhooks/nuevo')}>Nuevo webhook</Button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">URL</th>
                  <th className="px-5 py-3 font-medium">Eventos</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {webhooks?.map((webhook) => (
                  <tr key={webhook.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{webhook.url}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {webhook.eventos.map((evento) => (
                          <Badge key={evento}>{evento}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tono={webhook.activo ? 'exito' : 'neutro'}>{webhook.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Ver entregas', onClick: () => navigate(`/webhooks/${webhook.id}/entregas`) },
                          { etiqueta: 'Eliminar', onClick: () => eliminar.mutate(webhook.id), tono: 'peligro' as const },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
}
