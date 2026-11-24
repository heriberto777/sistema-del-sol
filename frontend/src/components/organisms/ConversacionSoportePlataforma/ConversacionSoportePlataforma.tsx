import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../../../lib/platform-api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Select } from '../../atoms/Select/Select';
import { ContenidoTiptap } from '../../molecules/ContenidoTiptap/ContenidoTiptap';
import { AdjuntoMensaje } from '../../molecules/AdjuntoMensaje/AdjuntoMensaje';
import { ComposerMensajeSoporte, type PayloadMensajeSoporte } from '../ComposerMensajeSoporte/ComposerMensajeSoporte';
import { ETIQUETA_CATEGORIA_SOPORTE, ETIQUETA_ESTADO_SOPORTE, type Categoria, type Estado, type MensajeSoporte } from '../../../types/soporte';

export interface TicketSoportePlataforma {
  id: string;
  asunto: string;
  categoria: Categoria;
  estado: Estado;
  tenant: {
    id: string;
    nombre: string;
    subdominio: string;
    rnc: string | null;
    telefono: string | null;
    email: string | null;
    plan: { nombre: string } | null;
  };
  usuario: { id: string; nombre: string; email: string | null };
}

/** Vista de conversación del lado plataforma — "Cambiar estado" es una acción separada de enviar un mensaje (ver tu captura), con panel "Contexto del Tenant" fijo a la derecha. */
export function ConversacionSoportePlataforma({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: ticket } = useQuery({
    queryKey: ['platform-reporte-tenant', ticketId],
    queryFn: async () => (await platformApiClient.get<TicketSoportePlataforma>(`/platform/reportes-tenant/${ticketId}`)).data,
  });

  const { data: mensajes, isLoading } = useQuery({
    queryKey: ['platform-reporte-tenant-mensajes', ticketId],
    queryFn: async () => (await platformApiClient.get<MensajeSoporte[]>(`/platform/reportes-tenant/${ticketId}/mensajes`)).data,
    refetchInterval: 15_000,
  });

  const enviar = useMutation({
    mutationFn: async (payload: PayloadMensajeSoporte) => platformApiClient.post(`/platform/reportes-tenant/${ticketId}/mensajes`, payload),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['platform-reporte-tenant-mensajes', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['platform-reporte-tenant', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['platform-reportes-tenant'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el mensaje.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async (estado: Estado) => platformApiClient.patch(`/platform/reportes-tenant/${ticketId}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-reporte-tenant', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['platform-reportes-tenant'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado.')),
  });

  if (!ticket) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900 dark:text-slate-100">{ticket.asunto}</p>
            <p className="truncate text-xs text-slate-400">
              {ticket.tenant.nombre} · {ETIQUETA_CATEGORIA_SOPORTE[ticket.categoria]}
            </p>
          </div>
          <Select
            value={ticket.estado}
            onChange={(e) => cambiarEstado.mutate(e.target.value as Estado)}
            className="!w-auto"
            aria-label="Cambiar estado"
          >
            {Object.entries(ETIQUETA_ESTADO_SOPORTE).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-3 dark:bg-slate-950">
          {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {mensajes?.map((m) => {
            const esMio = m.autorTipo === 'SOPORTE';
            return (
              <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-xl px-3 py-1.5 text-sm ${
                    esMio
                      ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                      : 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-60">
                    {esMio ? (m.autorAdmin?.nombre ?? 'Vos') : (m.autorUsuario?.nombre ?? ticket.usuario.nombre)}
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

      <div className="w-64 shrink-0 overflow-y-auto border-l border-slate-200 p-4 dark:border-slate-700">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contexto del tenant</h3>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Tenant</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{ticket.tenant.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Plan</dt>
            <dd className="text-slate-700 dark:text-slate-300">{ticket.tenant.plan?.nombre ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">RNC</dt>
            <dd className="text-slate-700 dark:text-slate-300">{ticket.tenant.rnc ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Contacto</dt>
            <dd className="text-slate-700 dark:text-slate-300">
              {ticket.usuario.nombre}
              {ticket.usuario.email && (
                <>
                  <br />
                  {ticket.usuario.email}
                </>
              )}
            </dd>
          </div>
          {ticket.tenant.telefono && (
            <div>
              <dt className="text-xs text-slate-400">Teléfono del tenant</dt>
              <dd className="text-slate-700 dark:text-slate-300">{ticket.tenant.telefono}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
