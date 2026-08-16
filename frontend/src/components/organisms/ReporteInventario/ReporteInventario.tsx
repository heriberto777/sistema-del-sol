import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { BotonesExportar } from '../../molecules/BotonesExportar/BotonesExportar';

interface StockReporte {
  cantidadActual: string;
  cantidadReservada: string;
  stockMinimo: string;
  producto: { codigo: string; nombre: string };
  bodega: { nombre: string };
}

interface ReporteInventarioResponse {
  items: StockReporte[];
  resumen: { productos: number; unidades: number; enAlerta: number };
}

export function ReporteInventario() {
  const { data, isLoading } = useQuery({
    queryKey: ['reporte-inventario'],
    queryFn: async () => (await apiClient.get<ReporteInventarioResponse>('/reportes/inventario')).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <BotonesExportar endpoint="/reportes/inventario/exportar" nombreBase="reporte-inventario" />
      </div>

      {!isLoading && data && (
        <div className="grid grid-cols-3 gap-4">
          <Resumen etiqueta="Líneas de producto" valor={String(data.resumen.productos)} />
          <Resumen etiqueta="Unidades totales" valor={data.resumen.unidades.toLocaleString('es-DO')} />
          <Resumen etiqueta="En alerta de stock bajo" valor={String(data.resumen.enAlerta)} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Bodega</th>
              <th className="px-4 py-2">Actual</th>
              <th className="px-4 py-2">Mínimo</th>
              <th className="px-4 py-2">Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.items.map((s, i) => {
              const enAlerta = Number(s.cantidadActual) < Number(s.stockMinimo);
              return (
                <tr key={i}>
                  <td className="px-4 py-2 font-mono text-xs">{s.producto.codigo}</td>
                  <td className="px-4 py-2">{s.producto.nombre}</td>
                  <td className="px-4 py-2">{s.bodega.nombre}</td>
                  <td className="px-4 py-2">{s.cantidadActual}</td>
                  <td className="px-4 py-2">{s.stockMinimo}</td>
                  <td className="px-4 py-2">{enAlerta && <Badge tono="advertencia">Bajo</Badge>}</td>
                </tr>
              );
            })}
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
