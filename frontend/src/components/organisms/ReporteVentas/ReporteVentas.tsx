import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { BotonesExportar } from '../../molecules/BotonesExportar/BotonesExportar';

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
          <Resumen etiqueta="Facturas" valor={String(data.resumen.cantidad)} />
          <Resumen etiqueta="Subtotal" valor={`RD$ ${data.resumen.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
          <Resumen etiqueta="ITBIS" valor={`RD$ ${data.resumen.itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
          <Resumen etiqueta="Total" valor={`RD$ ${data.resumen.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">NCF</th>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.facturas.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2 font-mono text-xs">{f.ncf ?? '—'}</td>
                <td className="px-4 py-2">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                <td className="px-4 py-2">{f.cliente.nombre}</td>
                <td className="px-4 py-2">{f.tipoFactura}</td>
                <td className="px-4 py-2">RD$ {Number(f.total).toLocaleString('es-DO')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{valor}</p>
    </div>
  );
}
