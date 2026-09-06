import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, X } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../hooks/useAuth';
import { reproducirAvisoSonoro } from '../../../lib/sonido-aviso';
import { useBandejaWhatsappDrawer } from '../BandejaWhatsappDrawer/BandejaWhatsappDrawerContext';
import { QUERY_KEY_PENDIENTES, type MensajePendiente } from '../BandejaWhatsappDrawer/BandejaWhatsappDrawer';

const DURACION_TOAST_MS = 8_000;

/**
 * Ícono con contador en el header global (mismo lugar que
 * `MarcarAsistenciaWidget`/`GlobalCrearMenu`) — visible desde cualquier
 * página del admin, incluida Facturación/POS (Concepto 1 elegido por el
 * usuario, mismo patrón que `CarritoDrawer` de la tienda). El conteo usa
 * la MISMA query key que el drawer para que react-query comparta una sola
 * suscripción con polling, en vez de duplicar el llamado a la API.
 *
 * Aviso urgente: cuando la cantidad de pendientes SUBE entre dos polls
 * (nunca en la carga inicial), suena un beep + aparece un toast con el
 * último mensaje — clickeable, abre el drawer directo en esa conversación.
 */
export function BandejaWhatsappWidget() {
  const { tienePermiso } = useAuth();
  const { abrir } = useBandejaWhatsappDrawer();
  const tienePermisoBandeja = tienePermiso('whatsapp.bandeja.usar');
  const cantidadAnterior = useRef<number | null>(null);
  const [toast, setToast] = useState<MensajePendiente | null>(null);

  const { data: pendientes } = useQuery({
    queryKey: QUERY_KEY_PENDIENTES,
    queryFn: async () => (await apiClient.get<MensajePendiente[]>('/admin/whatsapp-bandeja')).data,
    refetchInterval: 20_000,
    // Sin esto, react-query pausa el polling cuando la pestaña pierde el
    // foco (default de la librería) — el aviso urgente necesita seguir
    // consultando en segundo plano, no solo cuando el empleado vuelve a
    // hacer clic en la pestaña.
    refetchIntervalInBackground: true,
    enabled: tienePermisoBandeja,
  });

  useEffect(() => {
    if (!pendientes) return;
    const anterior = cantidadAnterior.current;
    // Nunca en la carga inicial (anterior === null) — solo en un incremento real entre dos polls.
    if (anterior !== null && pendientes.length > anterior) {
      setToast(pendientes[0]);
      reproducirAvisoSonoro();
    }
    cantidadAnterior.current = pendientes.length;
  }, [pendientes]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), DURACION_TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  if (!tienePermisoBandeja) return null;
  const cantidad = pendientes?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => abrir()}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Bandeja de WhatsApp"
      >
        <MessageCircle size={18} />
        {cantidad > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {cantidad}
          </span>
        )}
      </button>

      {toast && (
        <div
          role="alert"
          className="fixed right-4 top-4 z-[60] w-80 cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onClick={() => {
            abrir(toast.telefono);
            setToast(null);
          }}
        >
          <div className="flex items-start gap-2">
            <MessageCircle size={16} className="mt-0.5 shrink-0 text-sol-600 dark:text-sol-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Necesita atención humana</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{toast.perfilNombre ?? toast.telefono.replace(/^whatsapp:/, '')}</p>
              <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">{toast.contenido}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setToast(null);
              }}
              aria-label="Cerrar aviso"
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
