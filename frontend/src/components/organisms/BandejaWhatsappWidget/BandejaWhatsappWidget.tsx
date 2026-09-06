import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../hooks/useAuth';
import { useBandejaWhatsappDrawer } from '../BandejaWhatsappDrawer/BandejaWhatsappDrawerContext';
import { QUERY_KEY_PENDIENTES, type MensajePendiente } from '../BandejaWhatsappDrawer/BandejaWhatsappDrawer';

/**
 * Ícono con contador en el header global (mismo lugar que
 * `MarcarAsistenciaWidget`/`GlobalCrearMenu`) — visible desde cualquier
 * página del admin, incluida Facturación/POS (Concepto 1 elegido por el
 * usuario, mismo patrón que `CarritoDrawer` de la tienda). El conteo usa
 * la MISMA query key que el drawer para que react-query comparta una sola
 * suscripción con polling, en vez de duplicar el llamado a la API.
 */
export function BandejaWhatsappWidget() {
  const { tienePermiso } = useAuth();
  const { abrir } = useBandejaWhatsappDrawer();

  const { data: pendientes } = useQuery({
    queryKey: QUERY_KEY_PENDIENTES,
    queryFn: async () => (await apiClient.get<MensajePendiente[]>('/admin/whatsapp-bandeja')).data,
    refetchInterval: 20_000,
    enabled: tienePermiso('whatsapp.bandeja.usar'),
  });

  if (!tienePermiso('whatsapp.bandeja.usar')) return null;
  const cantidad = pendientes?.length ?? 0;

  return (
    <button
      type="button"
      onClick={abrir}
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
  );
}
