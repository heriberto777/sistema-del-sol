import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { StatCard } from '../../molecules/StatCard/StatCard';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';

interface ReporteCierres {
  totalVentas: number;
  cantidadSesiones: number;
  sobrantes: { cantidad: number; monto: number };
  faltantes: { cantidad: number; monto: number };
  exactas: number;
  diferenciaTotal: number;
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

/** Reporte-dashboard de cierres de caja (plan de integración Cuadre, ítem E-6) — antes solo existía el listado de turnos, sin agregados. */
export function CierresCajaDashboard() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pos-reporte-cierres', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<ReporteCierres>('/pos/turnos/reporte-cierres', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <FormField id="cierres-desde" label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
        <FormField id="cierres-hasta" label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          etiqueta="Total ventas"
          valor={isLoading ? '…' : formatoRD(data?.totalVentas ?? 0)}
          variacion={isLoading ? undefined : `${data?.cantidadSesiones ?? 0} sesión(es)`}
        />
        <StatCard
          etiqueta="Sobrantes"
          valor={isLoading ? '…' : String(data?.sobrantes.cantidad ?? 0)}
          variacion={isLoading ? undefined : formatoRD(data?.sobrantes.monto ?? 0)}
        />
        <StatCard
          etiqueta="Faltantes"
          valor={isLoading ? '…' : String(data?.faltantes.cantidad ?? 0)}
          variacion={isLoading ? undefined : formatoRD(data?.faltantes.monto ?? 0)}
        />
        <StatCard
          etiqueta="Diferencia total"
          valor={isLoading ? '…' : formatoRD(data?.diferenciaTotal ?? 0)}
          variacion={isLoading ? undefined : `${data?.exactas ?? 0} exacta(s)`}
        />
      </div>
    </div>
  );
}
