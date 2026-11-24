import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { ContenidoTiptap } from '../../molecules/ContenidoTiptap/ContenidoTiptap';
import { AdjuntoMensaje } from '../../molecules/AdjuntoMensaje/AdjuntoMensaje';
import { ComposerMensajeSoporte, type PayloadMensajeSoporte } from '../ComposerMensajeSoporte/ComposerMensajeSoporte';
import { ETIQUETA_CATEGORIA_SOPORTE, ETIQUETA_ESTADO_SOPORTE, TONO_ESTADO_SOPORTE, type MensajeSoporte, type TicketSoporte } from '../../../types/soporte';

/** Vista de conversación del lado tenant — el propio tenant siempre puede escribir, incluso en un ticket RESUELTO (reabre a EN_REVISION, ver ReportesTenantService). */
export function ConversacionSoporte({ ticket }: { ticket: TicketSoporte }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: mensajes, isLoading } = useQuery({
    queryKey: ['reportes-tenant-mensajes', ticket.id],
    queryFn: async () => (await apiClient.get<MensajeSoporte[]>(`/reportes-tenant/${ticket.id}/mensajes`)).data,
    refetchInterval: 15_000,
  });

  const enviar = useMutation({
    mutationFn: async (payload: PayloadMensajeSoporte) => apiClient.post(`/reportes-tenant/${ticket.id}/mensajes`, payload),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['reportes-tenant-mensajes', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['reportes-tenant'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el mensaje.')),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{ticket.asunto}</p>
          <p className="text-xs text-slate-400">{ETIQUETA_CATEGORIA_SOPORTE[ticket.categoria]}</p>
        </div>
        <Badge tono={TONO_ESTADO_SOPORTE[ticket.estado]}>{ETIQUETA_ESTADO_SOPORTE[ticket.estado]}</Badge>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-3 dark:bg-slate-950">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {mensajes?.map((m) => {
          const esPropio = m.autorTipo === 'TENANT';
          return (
            <div key={m.id} className={`flex ${esPropio ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-xl px-3 py-1.5 text-sm ${
                  esPropio
                    ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                    : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  {esPropio ? (m.autorUsuario?.nombre ?? 'Vos') : (m.autorAdmin?.nombre ?? 'Equipo de soporte')}
                </span>
                <ContenidoTiptap documento={m.cuerpo} />
                {m.adjuntoBase64 && m.adjuntoNombre && <AdjuntoMensaje base64={m.adjuntoBase64} nombre={m.adjuntoNombre} />}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 pt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <ComposerMensajeSoporte onEnviar={(payload) => enviar.mutate(payload)} enviando={enviar.isPending} />
    </div>
  );
}
