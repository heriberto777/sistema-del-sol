import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
}

interface MovimientoLibroMayor {
  fecha: string;
  asientoNumero: number;
  concepto: string;
  debito: number;
  credito: number;
  saldoAcumulado: number;
}

interface LibroMayor {
  cuenta: { codigo: string; nombre: string };
  saldoInicial: number;
  movimientos: MovimientoLibroMayor[];
  saldoFinal: number;
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

export function LibroMayorView() {
  const [cuentaId, setCuentaId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['contabilidad-libro-mayor', cuentaId, desde, hasta],
    enabled: !!cuentaId,
    queryFn: async () =>
      (
        await apiClient.get<LibroMayor>(`/contabilidad/libro-mayor/${cuentaId}`, {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta</label>
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Seleccioná una cuenta…</option>
            {cuentas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nombre}
              </option>
            ))}
          </select>
        </div>
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

      {!cuentaId && <p className="text-sm text-slate-500 dark:text-slate-400">Elegí una cuenta para ver su movimiento.</p>}
      {isLoading && <p className="text-sm text-slate-500">Cargando libro mayor…</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar el libro mayor de esta cuenta.</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard etiqueta="Saldo inicial" valor={formatoRD(data.saldoInicial)} />
            <StatCard etiqueta="Saldo final" valor={formatoRD(data.saldoFinal)} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Asiento</th>
                  <th className="px-4 py-2">Concepto</th>
                  <th className="px-4 py-2 text-right">Débito</th>
                  <th className="px-4 py-2 text-right">Crédito</th>
                  <th className="px-4 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.movimientos.map((m, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{new Date(m.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-4 py-2">#{m.asientoNumero}</td>
                    <td className="px-4 py-2">{m.concepto}</td>
                    <td className="px-4 py-2 text-right">{m.debito > 0 ? formatoRD(m.debito) : '—'}</td>
                    <td className="px-4 py-2 text-right">{m.credito > 0 ? formatoRD(m.credito) : '—'}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatoRD(m.saldoAcumulado)}</td>
                  </tr>
                ))}
                {data.movimientos.length === 0 && (
                  <tr>
                    <td className="px-4 py-2 text-slate-400" colSpan={6}>
                      Sin movimientos en el rango
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
