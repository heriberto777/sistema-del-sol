import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { Badge } from '../../atoms/Badge/Badge';

interface FilaRentabilidad {
  productoId: string;
  producto: string;
  cantidad: number;
  ventasNetas: number;
  costo: number;
  margen: number;
  margenPct: number;
}

/** Catálogo de reportes ampliado (plan de integración Cuadre, ítem J-2) — margen bruto por producto usando el costo vigente (no snapshot histórico, ver ARCHITECTURE.md). */
export function ReporteRentabilidad() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-rentabilidad', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<{ filas: FilaRentabilidad[] }>('/reportes/ventas/rentabilidad', {
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
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        El costo usado es el vigente HOY de cada producto, no el costo real al momento de cada venta (las líneas de factura no guardan
        una copia del costo histórico).
      </p>

      <Card sinPadding titulo="Rentabilidad por producto">
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium">Cantidad</th>
                <th className="px-5 py-3 font-medium">Ventas netas</th>
                <th className="px-5 py-3 font-medium">Costo</th>
                <th className="px-5 py-3 font-medium">Margen</th>
                <th className="px-5 py-3 font-medium">% Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.filas.map((f) => (
                <tr key={f.productoId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.producto}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.cantidad}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {f.ventasNetas.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {f.costo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {f.margen.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3">
                    <Badge tono={f.margenPct >= 0 ? 'exito' : 'peligro'}>{f.margenPct.toFixed(1)}%</Badge>
                  </td>
                </tr>
              ))}
              {data?.filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                    Sin ventas en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
