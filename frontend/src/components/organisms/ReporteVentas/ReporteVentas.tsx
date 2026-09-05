import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { BotonesExportar } from '../../molecules/BotonesExportar/BotonesExportar';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface FacturaReporte {
  id: string;
  ncf: string | null;
  fecha: string;
  tipoFactura: string;
  subtotal: string;
  itbis: string;
  total: string;
  cliente: { nombre: string };
}

interface ReporteVentasResponse {
  facturas: FacturaReporte[];
  resumen: { cantidad: number; subtotal: number; itbis: number; total: number };
}

export function ReporteVentas() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-ventas', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<ReporteVentasResponse>('/reportes/ventas', {
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
        <BotonesExportar endpoint="/reportes/ventas/exportar" params={{ desde, hasta }} nombreBase="reporte-ventas" />
      </div>

      {!isLoading && data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard etiqueta="Facturas" valor={String(data.resumen.cantidad)} />
          <StatCard etiqueta="Subtotal" valor={`RD$ ${data.resumen.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
          <StatCard etiqueta="ITBIS" valor={`RD$ ${data.resumen.itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
          <StatCard etiqueta="Total" valor={`RD$ ${data.resumen.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
        </div>
      )}

      <Card sinPadding titulo="Facturas del período">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">NCF</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.facturas.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{f.ncf ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.cliente.nombre}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.tipoFactura}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {Number(f.total).toLocaleString('es-DO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
