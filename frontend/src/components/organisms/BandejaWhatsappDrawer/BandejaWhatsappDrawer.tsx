import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, X } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { ConversacionWhatsapp } from '../ConversacionWhatsapp/ConversacionWhatsapp';
import { useBandejaWhatsappDrawer } from './BandejaWhatsappDrawerContext';

export interface MensajePendiente {
  id: string;
  telefono: string;
  contenido: string;
  perfilNombre: string | null;
  createdAt: string;
}

/** Query key compartida con `BandejaWhatsappWidget` — un solo polling, no dos. */
export const QUERY_KEY_PENDIENTES = ['whatsapp-bandeja'];

/**
 * Panel lateral de altura completa (Concepto 1 elegido por el usuario,
 * mismo patrón que `CarritoDrawer` de la tienda) — reemplaza al viejo
 * `BandejaWhatsappPanel` de Administración → Integraciones. Dos vistas
 * internas (lista de pendientes / conversación completa), sin rutear —
 * es más simple que meterlo en el context, y nada más lo necesita.
 */
export function BandejaWhatsappDrawer() {
  const { abierto, telefonoInicial, cerrar } = useBandejaWhatsappDrawer();
  const [telefonoActivo, setTelefonoActivo] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return undefined;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [abierto, cerrar]);

  useEffect(() => {
    if (!abierto) setTelefonoActivo(null);
  }, [abierto]);

  // Abrir desde el toast de aviso urgente salta directo a esa conversación
  // en vez de la lista (ver BandejaWhatsappWidget).
  useEffect(() => {
    if (abierto && telefonoInicial) setTelefonoActivo(telefonoInicial);
  }, [abierto, telefonoInicial]);

  const { data: pendientes, isLoading: cargandoPendientes } = useQuery({
    queryKey: QUERY_KEY_PENDIENTES,
    queryFn: async () => (await apiClient.get<MensajePendiente[]>('/admin/whatsapp-bandeja')).data,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    enabled: abierto,
  });

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={cerrar} aria-hidden="true" />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-slate-900">
        {!telefonoActivo && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <MessageCircle size={18} />
                Bandeja de WhatsApp
              </h2>
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cargandoPendientes && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
              {pendientes?.length === 0 && (
                <div className="p-5">
                  <EstadoVacio titulo="Sin pendientes" descripcion="No hay conversaciones de WhatsApp esperando atención." />
                </div>
              )}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendientes?.map((mensaje) => (
                  <button
                    key={mensaje.id}
                    type="button"
                    onClick={() => setTelefonoActivo(mensaje.telefono)}
                    className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {mensaje.perfilNombre ?? mensaje.telefono.replace(/^whatsapp:/, '')}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(mensaje.createdAt).toLocaleString('es-DO')}</span>
                    </div>
                    <span className="truncate text-sm text-slate-500 dark:text-slate-400">{mensaje.contenido}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {telefonoActivo && (
          <ConversacionWhatsapp
            key={telefonoActivo}
            telefono={telefonoActivo}
            onVolver={() => setTelefonoActivo(null)}
            accionesExtra={
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
