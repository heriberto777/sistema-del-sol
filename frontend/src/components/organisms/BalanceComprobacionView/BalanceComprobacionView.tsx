import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface CuentaBalance {
  codigo: string;
  nombre: string;
  totalDebito: number;
  totalCredito: number;
  saldo: number;
}

interface BalanceComprobacion {
  rango: { desde: string; hasta: string };
  cuentas: CuentaBalance[];
  totales: { debito: number; credito: number };
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

export function BalanceComprobacionView() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['contabilidad-balance-comprobacion', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<BalanceComprobacion>('/contabilidad/balance-comprobacion', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  const diferencia = data ? data.totales.debito - data.totales.credito : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta (por defecto: hoy)</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Calculando balance de comprobación…</p>}
      {error && <p className="text-sm text-red-600">No se pudo calcular el balance de comprobación.</p>}

      {data && (
        <>
          <StatCard
            etiqueta="Diferencia (Débito total − Crédito total)"
            valor={formatoRD(diferencia)}
            variacion={Math.abs(diferencia) < 0.01 ? 'Balanza cuadrada' : 'Revisar: no debería haber diferencia'}
          />

          <Card titulo="Balance de comprobación" sinPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Cuenta</th>
                    <th className="px-5 py-3 text-right font-medium">Total débito</th>
                    <th className="px-5 py-3 text-right font-medium">Total crédito</th>
                    <th className="px-5 py-3 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.cuentas.map((c) => (
                    <tr key={c.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        {c.codigo} — {c.nombre}
                      </td>
                      <td className="px-5 py-3 text-right">{formatoRD(c.totalDebito)}</td>
                      <td className="px-5 py-3 text-right">{formatoRD(c.totalCredito)}</td>
                      <td className="px-5 py-3 text-right font-medium">{formatoRD(c.saldo)}</td>
                    </tr>
                  ))}
                  {data.cuentas.length === 0 && (
                    <tr>
                      <td className="px-5 py-3 text-slate-400" colSpan={4}>
                        Sin movimientos en el rango
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-medium dark:border-slate-800">
                    <td className="px-5 py-3">Total</td>
                    <td className="px-5 py-3 text-right">{formatoRD(data.totales.debito)}</td>
                    <td className="px-5 py-3 text-right">{formatoRD(data.totales.credito)}</td>
                    <td className="px-5 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
