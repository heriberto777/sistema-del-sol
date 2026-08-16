import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface SaldoCuenta {
  codigo: string;
  nombre: string;
  saldo: number;
}

interface EstadoResultados {
  rango: { desde: string; hasta: string };
  ingresos: { cuentas: SaldoCuenta[]; total: number };
  gastos: { cuentas: SaldoCuenta[]; total: number };
  utilidadNeta: number;
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

function GrupoCuentas({ titulo, grupo }: { titulo: string; grupo: { cuentas: SaldoCuenta[]; total: number } }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">{titulo}</h3>
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {grupo.cuentas.map((cuenta) => (
            <tr key={cuenta.codigo}>
              <td className="py-1 text-slate-600 dark:text-slate-400">
                {cuenta.codigo} — {cuenta.nombre}
              </td>
              <td className="py-1 text-right">{formatoRD(cuenta.saldo)}</td>
            </tr>
          ))}
          {grupo.cuentas.length === 0 && (
            <tr>
              <td className="py-1 text-slate-400" colSpan={2}>
                Sin movimientos en el rango
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 font-medium dark:border-slate-800">
            <td className="py-1">Total</td>
            <td className="py-1 text-right">{formatoRD(grupo.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function EstadoResultadosView() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['contabilidad-estado-resultados', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<EstadoResultados>('/contabilidad/estado-resultados', {
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
        <p className="text-xs text-slate-500 dark:text-slate-400">Por defecto: mes actual</p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Calculando estado de resultados…</p>}
      {error && <p className="text-sm text-red-600">No se pudo calcular el estado de resultados.</p>}

      {data && (
        <>
          <StatCard etiqueta="Utilidad neta" valor={formatoRD(data.utilidadNeta)} />
          <div className="grid gap-4 md:grid-cols-2">
            <GrupoCuentas titulo="Ingresos" grupo={data.ingresos} />
            <GrupoCuentas titulo="Gastos" grupo={data.gastos} />
          </div>
        </>
      )}
    </div>
  );
}
