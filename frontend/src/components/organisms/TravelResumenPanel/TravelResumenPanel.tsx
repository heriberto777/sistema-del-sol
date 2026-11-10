import { useQuery } from '@tanstack/react-query';
import { Clock, DollarSign, Plane, Wallet } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { formatoMoneda } from '../../../lib/formato-moneda-travel';
import { Card } from '../../atoms/Card/Card';
import { StatCard } from '../../molecules/StatCard/StatCard';
import { COLOR_ESTADO_TRAVEL_RESERVA, ESTADOS_TRAVEL_RESERVA, ETIQUETA_ESTADO_TRAVEL_RESERVA } from '../../../types/travel';

interface ResumenTravel {
  reservasPorEstado: Record<string, number>;
  ingresosMes: number;
  pendientesDeFacturar: number;
  saldoLedger: { moneda: string; saldo: number }[];
}

/** Extraído de TravelReservas.tsx (auditoría UX Fase 5) — también sirve como el reporte propio de Travel (menú > Reportes). */
export function TravelResumenPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['travel-resumen'],
    queryFn: async () => (await apiClient.get<ResumenTravel>('/admin/travel/reservas/resumen')).data,
  });

  if (isLoading || !data) return <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const totalReservas = Object.values(data.reservasPorEstado).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard etiqueta="Reservas totales" valor={String(totalReservas)} icono={Plane} />
        <StatCard etiqueta="Ingresos facturados (mes)" valor={formatoMoneda(String(data.ingresosMes), 'DOP')} icono={DollarSign} />
        <StatCard etiqueta="Confirmadas sin facturar" valor={String(data.pendientesDeFacturar)} icono={Clock} />
        <StatCard
          etiqueta="Saldo vs. Balance Duffel"
          valor={data.saldoLedger.length === 0 ? '—' : data.saldoLedger.map((s) => `${s.moneda} ${s.saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`).join(' · ')}
          icono={Wallet}
        />
      </div>

      <Card titulo="Reservas por estado">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ESTADOS_TRAVEL_RESERVA.map((estado) => (
            <div key={estado} className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/60">
              <p className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO_TRAVEL_RESERVA[estado]}`}>{ETIQUETA_ESTADO_TRAVEL_RESERVA[estado]}</p>
              <p className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">{data.reservasPorEstado[estado] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
