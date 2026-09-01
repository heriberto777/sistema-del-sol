import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

interface MensajeCajas {
  texto: string;
  fecha: string;
}

const INTERVALO_POLLING_MS = 30_000;

/**
 * "Mensaje a cajas" (plan de integración Cuadre, ítem J-3) — banner con
 * polling, visible en toda sesión de POS activa. `turnoCajaId` (ítem
 * "por caja puntual"): si esta caja tiene un mensaje dirigido, gana
 * sobre el broadcast general — ver `PosService.obtenerMensajeCajas`.
 */
export function MensajeCajasBanner({ turnoCajaId }: { turnoCajaId: string }) {
  const [descartadoFecha, setDescartadoFecha] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['pos-mensaje-cajas', turnoCajaId],
    queryFn: async () => (await apiClient.get<MensajeCajas | null>('/pos/mensaje-cajas', { params: { turnoCajaId } })).data,
    refetchInterval: INTERVALO_POLLING_MS,
  });

  if (!data || data.fecha === descartadoFecha) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-5 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      <span>
        <strong>Aviso:</strong> {data.texto}
      </span>
      <button
        type="button"
        onClick={() => setDescartadoFecha(data.fecha)}
        className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
        aria-label="Descartar aviso"
      >
        ×
      </button>
    </div>
  );
}
