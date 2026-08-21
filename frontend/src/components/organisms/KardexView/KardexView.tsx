import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface MovimientoKardex {
  fecha: string;
  tipo: string;
  direccion: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  motivo: string | null;
  usuario: string;
  bodega: { id: string; nombre: string };
  saldoAcumulado: number;
}

interface Kardex {
  saldoInicial: number;
  movimientos: MovimientoKardex[];
  saldoFinal: number;
}

const ETIQUETA_TIPO: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  TRANSFERENCIA: 'Transferencia',
  AJUSTE: 'Ajuste',
};

/** Historial cronológico con saldo corriente (Fase 5a) — molde calcado de LibroMayorView, fijo a una variante+bodega por defecto (ya viene resuelta por el caller, ver Inventario.tsx), con un toggle para agregar en todas las bodegas del tenant (plan de integración Cuadre, ítem E-3). */
export function KardexView({ varianteId, bodegaId }: { varianteId: string; bodegaId: string }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [todasLasBodegas, setTodasLasBodegas] = useState(false);
  const bodegaFiltro = todasLasBodegas ? undefined : bodegaId;

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventario-kardex', varianteId, bodegaFiltro, desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<Kardex>(`/inventario/kardex/${varianteId}`, {
          params: { bodegaId: bodegaFiltro, desde: desde || undefined, hasta: hasta || undefined },
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
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={todasLasBodegas} onChange={(e) => setTodasLasBodegas(e.target.checked)} />
          Todas las bodegas
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">Por defecto: mes actual</p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Cargando kardex…</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar el kardex de este producto.</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard etiqueta="Saldo inicial" valor={data.saldoInicial.toLocaleString('es-DO')} />
            <StatCard etiqueta="Saldo final" valor={data.saldoFinal.toLocaleString('es-DO')} />
          </div>

          <Card titulo="Movimientos" sinPadding>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    {todasLasBodegas && <th className="px-5 py-3 font-medium">Bodega</th>}
                    <th className="px-5 py-3 font-medium">Motivo</th>
                    <th className="px-5 py-3 font-medium">Usuario</th>
                    <th className="px-5 py-3 text-right font-medium">Cantidad</th>
                    <th className="px-5 py-3 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.movimientos.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">{new Date(m.fecha).toLocaleString('es-DO')}</td>
                      <td className="px-5 py-3">{ETIQUETA_TIPO[m.tipo] ?? m.tipo}</td>
                      {todasLasBodegas && <td className="px-5 py-3">{m.bodega.nombre}</td>}
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{m.motivo ?? '—'}</td>
                      <td className="px-5 py-3">{m.usuario}</td>
                      <td className={`px-5 py-3 text-right ${m.direccion === 'ENTRADA' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.direccion === 'ENTRADA' ? '+' : '−'}
                        {m.cantidad.toLocaleString('es-DO')}
                      </td>
                      <td className="px-5 py-3 text-right font-medium">{m.saldoAcumulado.toLocaleString('es-DO')}</td>
                    </tr>
                  ))}
                  {data.movimientos.length === 0 && (
                    <tr>
                      <td className="px-5 py-3 text-slate-400" colSpan={todasLasBodegas ? 7 : 6}>
                        Sin movimientos en el rango
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
