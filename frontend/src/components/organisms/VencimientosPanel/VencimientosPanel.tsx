import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

interface LoteVencimiento {
  id: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidadActual: string;
  variante: { producto: { codigo: string; nombre: string } };
  bodega: { nombre: string };
}

/** Reporte de vencimientos próximos (Fase 5b) — todas las bodegas del tenant, sin paginar (mismo criterio que reportes/). */
export function VencimientosPanel() {
  const { data: lotes, isLoading } = useQuery({
    queryKey: ['inventario-vencimientos'],
    queryFn: async () => (await apiClient.get<LoteVencimiento[]>('/inventario/vencimientos')).data,
  });

  return (
    <div className="overflow-x-auto">
      {isLoading && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-medium">Producto</th>
            <th className="px-5 py-3 font-medium">Bodega</th>
            <th className="px-5 py-3 font-medium">Lote</th>
            <th className="px-5 py-3 font-medium">Vence</th>
            <th className="px-5 py-3 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lotes?.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                {l.variante.producto.codigo} — {l.variante.producto.nombre}
              </td>
              <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{l.bodega.nombre}</td>
              <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{l.numeroLote}</td>
              <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(l.fechaVencimiento).toLocaleDateString('es-DO', { timeZone: 'UTC' })}</td>
              <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{Number(l.cantidadActual)}</td>
            </tr>
          ))}
          {lotes?.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                Ningún lote vence en los próximos 30 días.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
