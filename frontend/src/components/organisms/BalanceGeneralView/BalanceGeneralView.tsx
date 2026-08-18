import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { StatCard } from '../../molecules/StatCard/StatCard';
import { GrupoCuentasContables } from '../../molecules/GrupoCuentasContables/GrupoCuentasContables';

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
            <GrupoCuentasContables titulo="Activo" grupo={data.activo} />
            <GrupoCuentasContables titulo="Pasivo" grupo={data.pasivo} />
            <GrupoCuentasContables titulo="Patrimonio" grupo={data.patrimonio} />
          </div>
        </>
      )}
    </div>
  );
}
