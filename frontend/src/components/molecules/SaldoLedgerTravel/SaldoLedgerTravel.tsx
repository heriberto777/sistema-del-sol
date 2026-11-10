import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { apiClient } from '../../../lib/api-client';

/**
 * Extraído de TravelReservas.tsx (auditoría UX Fase 5) — saldo del ledger
 * interno vs. el Balance real de la cuenta propia del tenant en Duffel/
 * Hotelbeds. Se muestra en las 5 páginas de Travel (antes vivía junto a la
 * barra de tabs, visible sin importar cuál estuviera activa).
 */
export function SaldoLedgerTravel() {
  const { data } = useQuery({
    queryKey: ['travel-ledger'],
    queryFn: async () => (await apiClient.get<{ moneda: string; saldo: number }[]>('/admin/travel/ledger')).data,
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium">Saldo vs. Balance Duffel:</span>
      {data.map((s) => (
        <span key={s.moneda} className={clsx('rounded-full px-2 py-0.5 font-mono font-semibold', s.saldo < 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-emerald-100 dark:bg-emerald-500/10')}>
          {s.moneda} {s.saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </span>
      ))}
    </div>
  );
}
