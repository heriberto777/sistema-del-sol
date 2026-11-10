import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Image } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { StatCard } from '../../molecules/StatCard/StatCard';

type EstadoPublicacion = 'BORRADOR' | 'PENDIENTE_APROBACION' | 'APROBADA' | 'RECHAZADA' | 'CAMBIOS_SOLICITADOS';

interface ResumenPublicacionesSociales {
  porEstado: Partial<Record<EstadoPublicacion, number>>;
  totalMes: number;
}

const ESTADOS: EstadoPublicacion[] = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'CAMBIOS_SOLICITADOS'];

const ETIQUETA_ESTADO: Record<EstadoPublicacion, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CAMBIOS_SOLICITADOS: 'Cambios solicitados',
};

/** Auditoría UX Fase 8 — reporte propio de Publicaciones Sociales (antes `reportes: []`). */
export function ReportePublicacionesSociales() {
  const { data, isLoading } = useQuery({
    queryKey: ['publicaciones-sociales-resumen'],
    queryFn: async () => (await apiClient.get<ResumenPublicacionesSociales>('/admin/publicaciones-sociales/resumen')).data,
  });

  if (isLoading || !data) return <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const total = Object.values(data.porEstado).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard etiqueta="Publicaciones totales" valor={String(total)} icono={Image} />
        <StatCard etiqueta="Creadas este mes" valor={String(data.totalMes)} icono={CalendarCheck} />
      </div>

      <Card titulo="Por estado">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ESTADOS.map((estado) => (
            <div key={estado} className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">{ETIQUETA_ESTADO[estado]}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{data.porEstado[estado] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
