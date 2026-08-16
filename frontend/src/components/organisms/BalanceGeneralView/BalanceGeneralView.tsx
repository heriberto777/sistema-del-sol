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

interface BalanceGeneral {
  fecha: string;
  activo: { cuentas: SaldoCuenta[]; total: number };
  pasivo: { cuentas: SaldoCuenta[]; total: number };
  patrimonio: { cuentas: SaldoCuenta[]; total: number };
  diferencia: number;
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
                Sin movimientos
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

export function BalanceGeneralView() {
  const [fecha, setFecha] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['contabilidad-balance-general', fecha],
    queryFn: async () =>
      (await apiClient.get<BalanceGeneral>('/contabilidad/balance-general', { params: { fecha: fecha || undefined } })).data,
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha (por defecto: hoy)</label>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="max-w-xs" />
      </div>

      {isLoading && <p className="text-sm text-slate-500">Calculando balance general…</p>}
      {error && <p className="text-sm text-red-600">No se pudo calcular el balance general.</p>}

      {data && (
        <>
          <StatCard
            etiqueta="Diferencia (Activo − Pasivo − Patrimonio)"
            valor={formatoRD(data.diferencia)}
            variacion={Math.abs(data.diferencia) < 0.01 ? 'Balance cuadrado' : 'Revisar: no debería haber diferencia'}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <GrupoCuentas titulo="Activo" grupo={data.activo} />
            <GrupoCuentas titulo="Pasivo" grupo={data.pasivo} />
            <GrupoCuentas titulo="Patrimonio" grupo={data.patrimonio} />
          </div>
        </>
      )}
    </div>
  );
}
