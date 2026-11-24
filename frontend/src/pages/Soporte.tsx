import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { textoPlanoDesdeTiptap } from '../lib/tiptap-texto-plano';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { ConversacionSoporte } from '../components/organisms/ConversacionSoporte/ConversacionSoporte';
import { ETIQUETA_CATEGORIA_SOPORTE, ETIQUETA_ESTADO_SOPORTE, TONO_ESTADO_SOPORTE, type Categoria, type Estado, type MensajeSoporte } from '../types/soporte';
import { PaginaResultado } from '../types/pagina-resultado';

interface TicketConUltimoMensaje {
  id: string;
  asunto: string;
  categoria: Categoria;
  estado: Estado;
  ultimoMensajeEn: string;
  createdAt: string;
  mensajes: MensajeSoporte[];
}

/**
 * "Soporte" (rediseño v2) — bandeja estilo inbox (lista + conversación
 * lado a lado), mismo patrón que `Mensajes.tsx` (inbox de WhatsApp). La
 * creación de un ticket vive en su propia página (`/soporte/nuevo`,
 * regla "Crear va en página, nunca en modal").
 */
export function Soporte() {
  const navigate = useNavigate();
  const [ticketSeleccionado, setTicketSeleccionado] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reportes-tenant'],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<TicketConUltimoMensaje>>('/reportes-tenant', { params: { tamanoPagina: 50 } })).data,
    refetchInterval: 20_000,
  });

  const ticketActivo = data?.datos.find((t) => t.id === ticketSeleccionado);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Soporte</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Reportá un problema, una duda o una idea — lo recibe directamente el equipo de la plataforma.
          </p>
        </div>
        <Button onClick={() => navigate('/soporte/nuevo')}>Nuevo reporte</Button>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800">
          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
            {!isLoading && data?.datos.length === 0 && (
              <div className="p-4">
                <EstadoVacio titulo="Sin tickets todavía" descripcion="Cuando crees uno, lo vas a ver listado acá con su estado y la conversación completa." />
              </div>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.datos.map((t) => {
                const seleccionado = ticketSeleccionado === t.id;
                const ultimoMensaje = t.mensajes[0];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTicketSeleccionado(t.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      seleccionado ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">{t.asunto}</span>
                      <span className="shrink-0 text-xs text-slate-400">{new Date(t.ultimoMensajeEn).toLocaleDateString('es-DO')}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {ultimoMensaje ? textoPlanoDesdeTiptap(ultimoMensaje.cuerpo) : ETIQUETA_CATEGORIA_SOPORTE[t.categoria]}
                      </span>
                      <Badge tono={TONO_ESTADO_SOPORTE[t.estado]}>{ETIQUETA_ESTADO_SOPORTE[t.estado]}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {ticketActivo ? (
            <ConversacionSoporte key={ticketActivo.id} ticket={ticketActivo} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EstadoVacio titulo="Elegí un ticket" descripcion="Seleccioná uno de la lista para ver la conversación completa." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
