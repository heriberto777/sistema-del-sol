import { useState } from 'react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface FilaPorVenta {
  facturaId: string;
  ncf: string | null;
  fecha: string;
  cliente: string;
  empleado: string;
  montoTotal: number;
  cantidadLineas: number;
}

interface FilaPorVendedor {
  empleadoId: string;
  empleado: string;
  montoTotal: number;
  cantidadVentas: number;
}

interface FilaPorProducto {
  productoId: string;
  producto: string;
  montoTotal: number;
  cantidadLineas: number;
}

const VISTAS = [
  { id: 'por-venta', etiqueta: 'Por venta' },
  { id: 'por-vendedor', etiqueta: 'Por vendedor' },
  { id: 'por-producto', etiqueta: 'Por producto' },
] as const;

type VistaId = (typeof VISTAS)[number]['id'];

/** Ítem A-1 — 3 reportes de comisiones de venta, mismo catálogo que Cuadre (por venta/vendedor/producto). */
export function ReporteComisiones() {
  const [vista, setVista] = useState<VistaId>('por-venta');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reporte-comisiones', vista, desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<{ rango: { desde: string; hasta: string }; datos: (FilaPorVenta | FilaPorVendedor | FilaPorProducto)[] }>(
          `/comisiones/${vista}`,
          { params: { desde: desde || undefined, hasta: hasta || undefined } },
        )
      ).data,
  });

  const montoTotalPeriodo = (data?.datos ?? []).reduce((acc, f) => acc + f.montoTotal, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={clsx(
              'border-b-2 px-3 py-2 text-sm font-medium',
              vista === v.id
                ? 'border-sol-500 text-sol-600 dark:text-sol-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
            )}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

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

      {!isLoading && data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard etiqueta="Comisión total del período" valor={`RD$ ${montoTotalPeriodo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
          <StatCard etiqueta="Filas" valor={String(data.datos.length)} />
        </div>
      )}

      <Card sinPadding titulo="Comisiones de venta">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            {vista === 'por-venta' && (
              <>
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">NCF</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Vendedor</th>
                    <th className="px-5 py-3 font-medium">Líneas</th>
                    <th className="px-5 py-3 font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data?.datos as FilaPorVenta[] | undefined)?.map((f) => (
                    <tr key={f.facturaId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{f.ncf ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.cliente}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.empleado}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.cantidadLineas}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {f.montoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {vista === 'por-vendedor' && (
              <>
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Vendedor</th>
                    <th className="px-5 py-3 font-medium">Ventas</th>
                    <th className="px-5 py-3 font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data?.datos as FilaPorVendedor[] | undefined)?.map((f) => (
                    <tr key={f.empleadoId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.empleado}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.cantidadVentas}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {f.montoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {vista === 'por-producto' && (
              <>
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Producto</th>
                    <th className="px-5 py-3 font-medium">Líneas</th>
                    <th className="px-5 py-3 font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data?.datos as FilaPorProducto[] | undefined)?.map((f) => (
                    <tr key={f.productoId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.producto}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.cantidadLineas}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">RD$ {f.montoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
          {data?.datos.length === 0 && (
            <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Sin comisiones generadas en el período.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
