import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { useAuth } from '../../../hooks/useAuth';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

type EstadoPeriodo = 'ABIERTO' | 'CERRADO';

interface Periodo {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodo;
  utilidadNeta: string | null;
  asientoCierre: { numero: number } | null;
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

function mesCapitalizado(fecha: Date) {
  const texto = fecha.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * El primer período de un tenant con historial previo a esta feature
 * (backfill-periodos-contables.ts) arranca en el epoch a propósito, para
 * arrastrar todo lo acumulado de antes — mostrar "Enero de 1970" tal cual
 * confundiría al usuario, así que ese caso puntual (rango de más de un
 * mes) se etiqueta distinto. Comparación en horario LOCAL, no UTC — las
 * fechas se construyen en local en todo el backend (rangoDelMes), mezclar
 * con UTC acá corre el mes mostrado cerca de medianoche.
 */
function etiquetaPeriodo(p: Pick<Periodo, 'fechaInicio' | 'fechaFin'>) {
  const inicio = new Date(p.fechaInicio);
  const fin = new Date(p.fechaFin);
  const mismoMes = inicio.getFullYear() === fin.getFullYear() && inicio.getMonth() === fin.getMonth();
  return mismoMes ? mesCapitalizado(inicio) : `Histórico hasta ${mesCapitalizado(fin)}`;
}

/**
 * Período Contable, Fase 1 — ya no se elige una fecha libre: los períodos
 * (mensuales, por calendario) se crean solos (ver
 * PeriodosContablesCronService, y TenantsRepository.crearConProvisioning
 * para uno nuevo) y solo se puede cerrar el ABIERTO más antiguo, para no
 * dejar huecos. Si se cierra antes de que el cron haya creado el
 * siguiente, el backend lo crea en el mismo paso.
 */
export function CierrePeriodoView() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-periodos'],
    queryFn: async () => (await apiClient.get<Periodo[]>('/contabilidad/cierre-periodo')).data,
  });

  const abiertoMasAntiguo = data
    ?.filter((p) => p.estado === 'ABIERTO')
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))[0];

  const cerrar = useMutation({
    mutationFn: async (periodoId: string) => apiClient.post('/contabilidad/cierre-periodo', { periodoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-periodos'] });
      setError(null);
    },
    onError: (err) =>
      setError(
        mensajeErrorApi(err, 'No se pudo cerrar el período — revisá que sea el más antiguo todavía abierto y que tenga movimientos de ingresos/gastos.'),
      ),
  });

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Los períodos (mensuales) se crean solos, no hace falta abrirlos a mano. Cerrar el más antiguo todavía abierto
        traspasa su saldo neto de ingresos y gastos a Utilidades Retenidas, con un asiento automático, y deja firme
        ese mes — ya no se pueden crear asientos manuales ni gastos con fecha dentro de él.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando períodos…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los períodos.</p>}

      {data && (
        <Card titulo="Períodos contables" sinPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Período</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Asiento de cierre</th>
                  <th className="px-5 py-3 text-right font-medium">Utilidad neta</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((p) => {
                  const utilidad = p.utilidadNeta != null ? Number(p.utilidadNeta) : null;
                  const esElMasAntiguoAbierto = p.id === abiertoMasAntiguo?.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{etiquetaPeriodo(p)}</td>
                      <td className="px-5 py-3">
                        <Badge tono={p.estado === 'ABIERTO' ? 'exito' : 'neutro'}>{p.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{p.asientoCierre ? `#${p.asientoCierre.numero}` : '—'}</td>
                      <td className="px-5 py-3 text-right">
                        {utilidad != null ? <Badge tono={utilidad >= 0 ? 'exito' : 'peligro'}>{formatoRD(utilidad)}</Badge> : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {esElMasAntiguoAbierto && tienePermiso('contabilidad.cerrarperiodo') && (
                          <Button variante="secundario" disabled={cerrar.isPending} onClick={() => cerrar.mutate(p.id)}>
                            {cerrar.isPending ? 'Cerrando…' : 'Cerrar'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td className="px-5 py-3 text-slate-400" colSpan={5}>
                      Todavía no hay ningún período contable creado
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
