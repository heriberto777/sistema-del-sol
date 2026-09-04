import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

interface MensajePendiente {
  id: string;
  telefono: string;
  contenido: string;
  createdAt: string;
}

/**
 * Escalación a humano del bot de WhatsApp (ítem H-2b) — sin chat en vivo
 * a propósito (decisión confirmada con el usuario): solo lista lo que el
 * bot marcó "necesita atención", deja responder manual desde acá, y
 * marcar el hilo como atendido.
 */
export function BandejaWhatsappPanel() {
  const queryClient = useQueryClient();
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ['whatsapp-bandeja'],
    queryFn: async () => (await apiClient.get<MensajePendiente[]>('/admin/whatsapp-bandeja')).data,
  });

  const responder = useMutation({
    mutationFn: async ({ telefono, contenido }: { telefono: string; contenido: string }) =>
      apiClient.post(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/responder`, { contenido }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-bandeja'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar la respuesta.')),
  });

  const marcarAtendido = useMutation({
    mutationFn: async (telefono: string) => apiClient.patch(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/atendido`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-bandeja'] }),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo marcar como atendido.')),
  });

  return (
    <Card
      sinPadding
      titulo="Bandeja de WhatsApp"
      descripcion="Mensajes que el bot no pudo resolver solo — respondé manual o marcá como atendido."
    >
      {isLoading && <p className="p-5 text-sm text-slate-500">Cargando…</p>}
      {error && <p className="px-5 text-sm text-red-600">{error}</p>}

      {pendientes?.length === 0 && (
        <div className="p-5">
          <EstadoVacio titulo="Sin pendientes" descripcion="No hay conversaciones de WhatsApp esperando atención." />
        </div>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {pendientes?.map((mensaje) => {
          const telefonoLegible = mensaje.telefono.replace(/^whatsapp:/, '');
          return (
            <div key={mensaje.id} className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900 dark:text-slate-100">{telefonoLegible}</p>
                <p className="text-xs text-slate-400">{new Date(mensaje.createdAt).toLocaleString('es-DO')}</p>
              </div>
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{mensaje.contenido}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escribí una respuesta…"
                  value={respuestas[mensaje.telefono] ?? ''}
                  onChange={(e) => setRespuestas((r) => ({ ...r, [mensaje.telefono]: e.target.value }))}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <Button
                  variante="secundario"
                  disabled={!respuestas[mensaje.telefono] || responder.isPending}
                  onClick={() => {
                    setError(null);
                    responder.mutate(
                      { telefono: mensaje.telefono, contenido: respuestas[mensaje.telefono] },
                      { onSuccess: () => setRespuestas((r) => ({ ...r, [mensaje.telefono]: '' })) },
                    );
                  }}
                >
                  Responder
                </Button>
                <Button variante="secundario" disabled={marcarAtendido.isPending} onClick={() => marcarAtendido.mutate(mensaje.telefono)}>
                  Marcar atendido
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
