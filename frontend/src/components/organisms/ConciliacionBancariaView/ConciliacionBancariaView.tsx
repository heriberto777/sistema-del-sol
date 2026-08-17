import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { StatCard } from '../../molecules/StatCard/StatCard';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface CuentaBancaria {
  id: string;
  banco: string;
  numeroCuenta: string;
}

interface Movimiento {
  id: string;
  fecha: string;
  concepto: string;
  debito: number;
  credito: number;
  conciliado: boolean;
}

interface Conciliacion {
  cuentaBancaria: { id: string; banco: string; numeroCuenta: string };
  rango: { desde: string; hasta: string };
  saldoSegunLibros: number;
  saldoConciliado: number;
  saldoPendiente: number;
  movimientos: Movimiento[];
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

export function ConciliacionBancariaView() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: bancos } = useQuery({
    queryKey: ['bancos-conciliacion'],
    queryFn: async () => (await apiClient.get<PaginaResultado<CuentaBancaria>>('/bancos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['contabilidad-conciliacion', cuentaBancariaId, desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<Conciliacion>(`/contabilidad/conciliacion/${cuentaBancariaId}`, {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
    enabled: !!cuentaBancariaId,
  });

  const marcarConciliada = useMutation({
    mutationFn: async ({ lineaId, conciliado }: { lineaId: string; conciliado: boolean }) =>
      apiClient.patch(`/contabilidad/conciliacion/lineas/${lineaId}`, { conciliado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contabilidad-conciliacion', cuentaBancariaId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta bancaria</label>
          <select
            value={cuentaBancariaId}
            onChange={(e) => setCuentaBancariaId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Seleccionar…</option>
            {bancos?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.banco} — {b.numeroCuenta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta (por defecto: hoy)</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {!cuentaBancariaId && <p className="text-sm text-slate-500">Seleccioná una cuenta bancaria para ver su conciliación.</p>}
      {isLoading && <p className="text-sm text-slate-500">Cargando conciliación…</p>}
      {error && <p className="text-sm text-red-600">No se pudo cargar la conciliación.</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard etiqueta="Saldo según libros" valor={formatoRD(data.saldoSegunLibros)} />
            <StatCard etiqueta="Conciliado" valor={formatoRD(data.saldoConciliado)} />
            <StatCard etiqueta="Pendiente de conciliar" valor={formatoRD(data.saldoPendiente)} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Concepto</th>
                  <th className="px-4 py-2 text-right">Débito</th>
                  <th className="px-4 py-2 text-right">Crédito</th>
                  <th className="px-4 py-2 text-center">Conciliado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.movimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2">{new Date(m.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-4 py-2">{m.concepto}</td>
                    <td className="px-4 py-2 text-right">{m.debito > 0 ? formatoRD(m.debito) : ''}</td>
                    <td className="px-4 py-2 text-right">{m.credito > 0 ? formatoRD(m.credito) : ''}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={m.conciliado}
                        disabled={!tienePermiso('contabilidad.conciliar') || marcarConciliada.isPending}
                        onChange={(e) => marcarConciliada.mutate({ lineaId: m.id, conciliado: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
                {data.movimientos.length === 0 && (
                  <tr>
                    <td className="px-4 py-2 text-slate-400" colSpan={5}>
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
