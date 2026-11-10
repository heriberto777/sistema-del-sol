import { useQuery } from '@tanstack/react-query';
import { Building2, FileText, HandCoins, Wallet } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { StatCard } from '../../molecules/StatCard/StatCard';
import { ESTADOS_PROPIEDAD, ETIQUETA_ESTADO_PROPIEDAD } from '../../../types/inmobiliaria';

interface ResumenInmobiliaria {
  propiedadesPorEstado: Record<string, number>;
  contratosActivos: number;
  comisionPendiente: number;
  alquileresPendientes: number;
  alquileresCobradosMes: number;
}

const fmt = (n: number) => `$${n.toLocaleString('es-DO', { maximumFractionDigits: 2 })}`;

/** Auditoría UX Fase 8 — reporte propio de Inmobiliaria (antes `reportes: []`). Agregados simples — las sumas no distinguen DOP/USD, cada contrato/propiedad individual sí muestra su moneda real en su propia pantalla. */
export function ReporteInmobiliaria() {
  const { data, isLoading } = useQuery({
    queryKey: ['inmobiliaria-resumen'],
    queryFn: async () => (await apiClient.get<ResumenInmobiliaria>('/admin/inmobiliaria/propiedades/resumen')).data,
  });

  if (isLoading || !data) return <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const totalPropiedades = Object.values(data.propiedadesPorEstado).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard etiqueta="Propiedades" valor={String(totalPropiedades)} icono={Building2} />
        <StatCard etiqueta="Contratos activos" valor={String(data.contratosActivos)} icono={FileText} />
        <StatCard etiqueta="Comisión pendiente de pago" valor={fmt(data.comisionPendiente)} icono={HandCoins} />
        <StatCard etiqueta="Alquileres cobrados (mes)" valor={fmt(data.alquileresCobradosMes)} icono={Wallet} />
      </div>

      <Card titulo="Propiedades por estado">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ESTADOS_PROPIEDAD.map((estado) => (
            <div key={estado} className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">{ETIQUETA_ESTADO_PROPIEDAD[estado]}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{data.propiedadesPorEstado[estado] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>

      {data.alquileresPendientes > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Hay {fmt(data.alquileresPendientes)} en cobros de alquiler todavía pendientes de cobrar.
        </p>
      )}
    </div>
  );
}
