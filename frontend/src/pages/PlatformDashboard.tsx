import { useQuery } from '@tanstack/react-query';
import { Building2, Ban, AlertTriangle, CalendarClock, PauseCircle, Wallet } from 'lucide-react';
import { platformApiClient } from '../lib/platform-api-client';
import { Card } from '../components/atoms/Card/Card';
import { StatCard } from '../components/molecules/StatCard/StatCard';

interface ResumenDashboard {
  tenants: { total: number; activos: number; suspendidos: number; cancelados: number };
  mrrAproximado: number;
  tenantsPorPlan: { planId: string; nombre: string; cantidadTenants: number }[];
  cartera: { totalPendiente: number; totalVencido: number; cantidadVencidas: number };
}

const fmtRD = (v: number) => `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

/** Ítem "dashboard de plataforma" — pantalla de inicio, landing tras el login. */
export function PlatformDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: async () => (await platformApiClient.get<ResumenDashboard>('/platform/dashboard')).data,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>

      {isLoading && <p className="text-sm text-slate-500">Cargando…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard etiqueta="Tenants activos" valor={String(data.tenants.activos)} icono={Building2} />
            <StatCard etiqueta="Tenants suspendidos" valor={String(data.tenants.suspendidos)} icono={PauseCircle} />
            <StatCard etiqueta="Tenants cancelados" valor={String(data.tenants.cancelados)} icono={Ban} />
            <StatCard etiqueta="Ingreso mensual aproximado (MRR)" valor={fmtRD(data.mrrAproximado)} icono={Wallet} />
            <StatCard etiqueta="Cartera pendiente" valor={fmtRD(data.cartera.totalPendiente)} icono={CalendarClock} />
            <StatCard
              etiqueta="Cartera vencida"
              valor={fmtRD(data.cartera.totalVencido)}
              variacion={`${data.cartera.cantidadVencidas} factura(s)`}
              icono={AlertTriangle}
            />
          </div>

          <Card sinPadding titulo="Tenants por plan">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Tenants</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.tenantsPorPlan.map((p) => (
                    <tr key={p.planId}>
                      <td className="px-5 py-3">{p.nombre}</td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{p.cantidadTenants}</td>
                    </tr>
                  ))}
                  {data.tenantsPorPlan.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-5 py-6 text-center text-slate-400">
                        Todavía no hay planes creados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
