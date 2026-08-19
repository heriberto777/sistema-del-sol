import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Input } from '../../atoms/Input/Input';
import { useAuth } from '../../../hooks/useAuth';

interface PeriodoCerrado {
  id: string;
  fecha: string;
  utilidadNeta: string;
  asientoCierre: { numero: number };
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

export function CierrePeriodoView() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-cierres-periodo'],
    queryFn: async () => (await apiClient.get<PeriodoCerrado[]>('/contabilidad/cierre-periodo')).data,
  });

  const cerrar = useMutation({
    mutationFn: async () => apiClient.post('/contabilidad/cierre-periodo', { fecha }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-cierres-periodo'] });
      setFecha('');
      setError(null);
    },
    onError: () =>
      setError('No se pudo cerrar el período — revisá que la fecha sea posterior al último cierre y que haya movimientos de ingresos/gastos en el rango.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    cerrar.mutate();
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Cerrar un período traspasa el saldo neto de ingresos y gastos acumulado desde el último cierre (o desde el
        inicio) hasta la fecha elegida a Utilidades Retenidas, con un asiento automático. Después del cierre, no se
        pueden crear asientos manuales ni gastos con fecha dentro del período cerrado.
      </p>

      {tienePermiso('contabilidad.editar') && (
        <Card titulo="Cerrar período">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha de corte</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <Button type="submit" disabled={cerrar.isPending || !fecha}>
              {cerrar.isPending ? 'Cerrando…' : 'Cerrar período'}
            </Button>
          </form>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-slate-500">Cargando cierres…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los cierres anteriores.</p>}

      {data && (
        <Card titulo="Cierres anteriores" sinPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Fecha de corte</th>
                  <th className="px-5 py-3 font-medium">Asiento de cierre</th>
                  <th className="px-5 py-3 text-right font-medium">Utilidad neta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((c) => {
                  const utilidad = Number(c.utilidadNeta);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">{new Date(c.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3">#{c.asientoCierre.numero}</td>
                      <td className="px-5 py-3 text-right">
                        <Badge tono={utilidad >= 0 ? 'exito' : 'peligro'}>{formatoRD(utilidad)}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td className="px-5 py-3 text-slate-400" colSpan={3}>
                      Todavía no se cerró ningún período
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
