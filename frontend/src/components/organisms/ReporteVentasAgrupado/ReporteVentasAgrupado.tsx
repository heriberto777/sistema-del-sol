import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { Select } from '../../atoms/Select/Select';

type Dimension = 'cliente' | 'categoria' | 'producto' | 'vendedor' | 'formaPago' | 'codigoAlterno';

const DIMENSIONES: { valor: Dimension; etiqueta: string }[] = [
  { valor: 'cliente', etiqueta: 'Por cliente' },
  { valor: 'categoria', etiqueta: 'Por categoría' },
  { valor: 'producto', etiqueta: 'Por producto' },
  { valor: 'vendedor', etiqueta: 'Por vendedor' },
  { valor: 'formaPago', etiqueta: 'Por tipo de pago' },
  { valor: 'codigoAlterno', etiqueta: 'Por código de barras' },
];

interface FilaAgrupada {
  etiqueta: string;
  cantidad: number;
  subtotal: number;
  itbis: number;
  total: number;
}

/** Catálogo de reportes ampliado (plan de integración Cuadre, ítem J-2) — ventas agrupadas por distintas dimensiones. */
export function ReporteVentasAgrupado() {
  const [dimension, setDimension] = useState<Dimension>('producto');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-ventas-agrupado', dimension, desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<{ filas: FilaAgrupada[] }>('/reportes/ventas/agrupado', {
          params: { dimension, desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  const etiquetaColumna = DIMENSIONES.find((d) => d.valor === dimension)?.etiqueta.replace('Por ', '') ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Agrupar por</label>
          <Select value={dimension} onChange={(e) => setDimension(e.target.value as Dimension)}>
            {DIMENSIONES.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.etiqueta}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      <Card sinPadding titulo="Ventas agrupadas">
        {isLoading && <p className="p-5 text-sm text-slate-500">Cargando…</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium capitalize">{etiquetaColumna}</th>
                <th className="px-5 py-3 font-medium">Cantidad</th>
                <th className="px-5 py-3 font-medium">Subtotal</th>
                <th className="px-5 py-3 font-medium">ITBIS</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.filas.map((f) => (
                <tr key={f.etiqueta} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">{f.etiqueta}</td>
                  <td className="px-5 py-3">{f.cantidad}</td>
                  <td className="px-5 py-3">RD$ {f.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3">RD$ {f.itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3">RD$ {f.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {data?.filas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
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
