import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Badge } from '../../atoms/Badge/Badge';
import { BotonesExportar } from '../../molecules/BotonesExportar/BotonesExportar';

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
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">Órdenes</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data.resumen.cantidad}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              RD$ {data.resumen.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
          {Object.entries(data.resumen.porEstado).map(([estado, cantidad]) => (
            <div key={estado} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">{estado}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{cantidad}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Número</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.ordenes.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2">{o.numero}</td>
                <td className="px-4 py-2">{new Date(o.fecha).toLocaleDateString('es-DO')}</td>
                <td className="px-4 py-2">{o.proveedor.nombre}</td>
                <td className="px-4 py-2">
                  <Badge>{o.estado}</Badge>
                </td>
                <td className="px-4 py-2">RD$ {Number(o.total).toLocaleString('es-DO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
