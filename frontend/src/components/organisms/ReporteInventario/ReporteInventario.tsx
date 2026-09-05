import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { BotonesExportar } from '../../molecules/BotonesExportar/BotonesExportar';
import { StatCard } from '../../molecules/StatCard/StatCard';
import { useSucursalActiva } from '../../../hooks/useSucursalActiva';

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
  const { sucursales, sucursalActivaId } = useSucursalActiva();
  // `null` = todavía no se tocó el filtro (usar la sucursal activa como
  // default); `''` = se eligió explícitamente "Todas las sucursales" —
  // hay que respetarlo, no recaer en sucursalActivaId otra vez.
  const [sucursalId, setSucursalId] = useState<string | null>(null);
  const sucursalFiltro = sucursalId !== null ? sucursalId : (sucursalActivaId ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-inventario', sucursalFiltro],
    queryFn: async () =>
      (await apiClient.get<ReporteInventarioResponse>('/reportes/inventario', { params: { sucursalId: sucursalFiltro || undefined } }))
        .data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {sucursales.length > 1 ? (
          <Select value={sucursalFiltro} onChange={(e) => setSucursalId(e.target.value)} className="!w-auto">
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        ) : (
          <div />
        )}
        <BotonesExportar
          endpoint="/reportes/inventario/exportar"
          params={{ sucursalId: sucursalFiltro || undefined }}
          nombreBase="reporte-inventario"
        />
      </div>

      {!isLoading && data && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard etiqueta="Líneas de producto" valor={String(data.resumen.productos)} />
          <StatCard etiqueta="Unidades totales" valor={data.resumen.unidades.toLocaleString('es-DO')} />
          <StatCard etiqueta="En alerta de stock bajo" valor={String(data.resumen.enAlerta)} />
        </div>
      )}

      <Card sinPadding titulo="Stock por bodega">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium">Bodega</th>
                <th className="px-5 py-3 font-medium">Actual</th>
                <th className="px-5 py-3 font-medium">Mínimo</th>
                <th className="px-5 py-3 font-medium">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.items.map((s, i) => {
                const enAlerta = Number(s.cantidadActual) < Number(s.stockMinimo);
                return (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{s.producto.codigo}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.producto.nombre}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.bodega.nombre}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.cantidadActual}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{s.stockMinimo}</td>
                    <td className="px-5 py-3">{enAlerta && <Badge tono="advertencia">Bajo</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
