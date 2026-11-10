import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Select } from '../../atoms/Select/Select';

interface Lote {
  id: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidadActual: string;
}

/**
 * Extraído de Inventario.tsx (auditoría UX Fase 2) — de qué lote sale un
 * ajuste manual negativo (siempre a mano, nunca FEFO: una corrección apunta
 * a un lote puntual). Ahora lo usan tanto el ajuste rápido de una línea
 * (`ModalAjustarStock`, en StockBodegasPanel) como el nuevo ajuste
 * multi-línea de página completa (`InventarioAjusteNuevo`).
 */
export function SelectorLoteAjuste({
  varianteId,
  bodegaId,
  value,
  onChange,
}: {
  varianteId: string;
  bodegaId: string;
  value: string;
  onChange: (loteId: string) => void;
}) {
  const { data: lotes } = useQuery({
    queryKey: ['inventario-lotes', varianteId, bodegaId],
    queryFn: async () => (await apiClient.get<Lote[]>('/inventario/lotes', { params: { varianteId, bodegaId } })).data,
    enabled: !!varianteId && !!bodegaId,
  });

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">De qué lote sale</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Seleccionar…</option>
        {lotes?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.numeroLote} — vence {new Date(l.fechaVencimiento).toLocaleDateString('es-DO', { timeZone: 'UTC' })} — saldo {Number(l.cantidadActual)}
          </option>
        ))}
      </Select>
    </div>
  );
}
