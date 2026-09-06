import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { ConversacionWhatsapp } from '../components/organisms/ConversacionWhatsapp/ConversacionWhatsapp';

interface ConversacionResumen {
  id: string;
  telefono: string;
  contenido: string;
  perfilNombre: string | null;
  createdAt: string;
}

/**
 * Inbox completo de WhatsApp (`whatsapp.mensajes.ver`, solo Gerente/Admin
 * Total — ver roles-base.ts) — TODAS las conversaciones, no solo las
 * pendientes de atención (eso sigue siendo la Bandeja/drawer global). Es
 * una página de solo navegación/búsqueda; responder o marcar atendido usa
 * el mismo `ConversacionWhatsapp` que ya usa el drawer.
 */
export function Mensajes() {
  const [busqueda, setBusqueda] = useState('');
  const [telefonoSeleccionado, setTelefonoSeleccionado] = useState<string | null>(null);

  const { data: conversaciones, isLoading } = useQuery({
    queryKey: ['whatsapp-mensajes-conversaciones'],
    queryFn: async () => (await apiClient.get<ConversacionResumen[]>('/admin/whatsapp-bandeja/conversaciones')).data,
    refetchInterval: 20_000,
  });

  const conversacionesFiltradas = useMemo(() => {
    if (!conversaciones) return [];
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return conversaciones;
    return conversaciones.filter(
      (c) => c.telefono.toLowerCase().includes(texto) || c.perfilNombre?.toLowerCase().includes(texto),
    );
  }, [conversaciones, busqueda]);

  return (
    <RequierePermiso permiso="whatsapp.mensajes.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Mensajes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Todas las conversaciones de WhatsApp, con o sin atención pendiente.</p>
        </div>

        <div className="flex h-[calc(100vh-220px)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-200 p-3 dark:border-slate-800">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por teléfono o nombre…" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
              {!isLoading && conversacionesFiltradas.length === 0 && (
                <div className="p-4">
                  <EstadoVacio titulo="Sin conversaciones" descripcion="Todavía no hay mensajes de WhatsApp para este negocio." />
                </div>
              )}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {conversacionesFiltradas.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTelefonoSeleccionado(c.telefono)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      telefonoSeleccionado === c.telefono ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {c.perfilNombre ?? c.telefono.replace(/^whatsapp:/, '')}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString('es-DO')}</span>
                    </div>
                    <span className="truncate text-sm text-slate-500 dark:text-slate-400">{c.contenido}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1">
            {telefonoSeleccionado ? (
              <ConversacionWhatsapp key={telefonoSeleccionado} telefono={telefonoSeleccionado} />
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <EstadoVacio titulo="Elegí una conversación" descripcion="Seleccioná un contacto de la lista para ver el historial completo." />
              </div>
            )}
          </div>
        </div>
      </div>
    </RequierePermiso>
  );
}
