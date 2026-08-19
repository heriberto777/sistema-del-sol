import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { BotonesExportar } from '../../molecules/BotonesExportar/BotonesExportar';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface OrdenReporte {
  id: string;
  numero: string;
  fecha: string;
  estado: string;
  total: string;
  proveedor: { nombre: string };
}

interface ReporteComprasResponse {
  ordenes: OrdenReporte[];
  resumen: { cantidad: number; total: number; porEstado: Record<string, number> };
}

export function ReporteCompras() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-compras', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<ReporteComprasResponse>('/reportes/compras', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <BotonesExportar endpoint="/reportes/compras/exportar" params={{ desde, hasta }} nombreBase="reporte-compras" />
      </div>

      {!isLoading && data && (
        <div className="flex flex-wrap gap-4">
          <StatCard etiqueta="Órdenes" valor={String(data.resumen.cantidad)} />
          <StatCard etiqueta="Total" valor={`RD$ ${data.resumen.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
          {Object.entries(data.resumen.porEstado).map(([estado, cantidad]) => (
            <StatCard key={estado} etiqueta={estado} valor={String(cantidad)} />
          ))}
        </div>
      )}

      <Card sinPadding titulo="Órdenes de compra">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Proveedor</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.ordenes.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">{o.numero}</td>
                  <td className="px-5 py-3">{new Date(o.fecha).toLocaleDateString('es-DO')}</td>
                  <td className="px-5 py-3">{o.proveedor.nombre}</td>
                  <td className="px-5 py-3">
                    <Badge>{o.estado}</Badge>
                  </td>
                  <td className="px-5 py-3">RD$ {Number(o.total).toLocaleString('es-DO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
