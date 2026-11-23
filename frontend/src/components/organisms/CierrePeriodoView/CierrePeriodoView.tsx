import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
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

// timeZone: 'UTC' a propósito — el backend construye fechaInicio/fechaFin
// en UTC (rangoDelMes, ver su comentario: tiene que coincidir con cómo
// new Date(dto.fecha) parsea una fecha suelta al crear un asiento),
// mostrarlas en horario local acá correría el mes cerca de medianoche
// (bug real encontrado en e2e, no solo en esta pantalla).
function mesCapitalizado(fecha: Date) {
  const texto = fecha.toLocaleDateString('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * El primer período de un tenant con historial previo a esta feature
 * (backfill-periodos-contables.ts) arranca en el epoch a propósito, para
 * arrastrar todo lo acumulado de antes — mostrar "Enero de 1970" tal cual
 * confundiría al usuario, así que ese caso puntual (rango de más de un
 * mes) se etiqueta distinto.
 */
function etiquetaPeriodo(p: Pick<Periodo, 'fechaInicio' | 'fechaFin'>) {
  const inicio = new Date(p.fechaInicio);
  const fin = new Date(p.fechaFin);
  const mismoMes = inicio.getUTCFullYear() === fin.getUTCFullYear() && inicio.getUTCMonth() === fin.getUTCMonth();
  return mismoMes ? mesCapitalizado(inicio) : `Histórico hasta ${mesCapitalizado(fin)}`;
}

interface AsistentePrecierre {
  riesgosContables: {
    conciliacionPendiente: { cuentaBancariaId: string; banco: string; numeroCuenta: string; saldoPendiente: number }[];
    turnosSinCerrar: { id: string; bodega: string; cajero: string; abiertoEn: string; estado: 'ABIERTO' | 'PENDIENTE_REVISION' }[];
  };
  pendientesComerciales: {
    cotizacionesSinConvertir: { id: string; numero: string; cliente: string; fecha: string; total: string }[];
    remisionesSinFacturar: { id: string; numero: string; cliente: string; fecha: string }[];
  };
}

/**
 * Asistente de pre-cierre (docs/PLAN.md) — checklist INFORMATIVO, nunca
 * bloquea: se muestra dentro del `ConfirmModal` de "Cerrar período".
 * "Riesgos contables" (conciliación/turnos de caja) es distinto de
 * "Pendientes comerciales" (cotizaciones/remisiones sin convertir) a
 * propósito — lo segundo nunca generó ni puede reabrir retroactivamente
 * un asiento de este período, es solo un recordatorio de proceso de
 * ventas (ver el comentario de `CierrePeriodoService.asistentePrecierre`).
 */
function AsistentePrecierreChecklist({ periodoId }: { periodoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['asistente-precierre', periodoId],
    queryFn: async () => (await apiClient.get<AsistentePrecierre>(`/contabilidad/cierre-periodo/${periodoId}/asistente-precierre`)).data,
  });

  if (isLoading || !data) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Revisando conciliación, turnos de caja y pendientes comerciales…</p>;
  }

  const { conciliacionPendiente, turnosSinCerrar } = data.riesgosContables;
  const { cotizacionesSinConvertir, remisionesSinFacturar } = data.pendientesComerciales;
  const sinRiesgos = conciliacionPendiente.length === 0 && turnosSinCerrar.length === 0;
  const sinPendientesComerciales = cotizacionesSinConvertir.length === 0 && remisionesSinFacturar.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Riesgos contables</p>
        {sinRiesgos ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Sin pendientes — conciliación al día y sin turnos de caja abiertos.</p>
        ) : (
          <ul className="space-y-1">
            {conciliacionPendiente.map((c) => (
              <li key={c.cuentaBancariaId} className="rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {c.banco} — {c.numeroCuenta}: RD$ {c.saldoPendiente.toLocaleString('es-DO', { minimumFractionDigits: 2 })} sin conciliar
              </li>
            ))}
            {turnosSinCerrar.map((t) => (
              <li key={t.id} className="rounded-md bg-amber-50 px-2 py-1.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Turno de caja {t.estado === 'ABIERTO' ? 'abierto' : 'pendiente de revisión'} — {t.bodega} ({t.cajero}), desde{' '}
                {new Date(t.abiertoEn).toLocaleDateString('es-DO')}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Pendientes comerciales (no afecta la contabilidad)
        </p>
        {sinPendientesComerciales ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Sin cotizaciones ni remisiones sueltas en este rango.</p>
        ) : (
          <ul className="space-y-1">
            {cotizacionesSinConvertir.map((c) => (
              <li key={c.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                Cotización {c.numero} — {c.cliente} sin convertir (RD$ {Number(c.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })})
              </li>
            ))}
            {remisionesSinFacturar.map((r) => (
              <li key={r.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                Remisión {r.numero} — {r.cliente} entregada sin facturar
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-slate-400">Nada de esto bloquea el cierre — es solo informativo.</p>
    </div>
  );
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
  const [mensajeCompletar, setMensajeCompletar] = useState<string | null>(null);
  const [periodoParaCerrar, setPeriodoParaCerrar] = useState<Periodo | null>(null);

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
      setPeriodoParaCerrar(null);
    },
    onError: (err) =>
      setError(
        mensajeErrorApi(err, 'No se pudo cerrar el período — revisá que sea el más antiguo todavía abierto y que tenga movimientos de ingresos/gastos.'),
      ),
  });

  // Manual, además del cron (que crea el mes siguiente 5 días antes de
  // fin de mes y no reintenta si se lo pierde) — incidente real
  // 2026-11-18: no hace falta cerrar nada viejo para destrabar esto,
  // "crear" y "cerrar" quedan desacoplados a propósito.
  const completarFaltantes = useMutation({
    mutationFn: async () => (await apiClient.post<Periodo[]>('/contabilidad/cierre-periodo/completar-faltantes')).data,
    onSuccess: (creados) => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-periodos'] });
      queryClient.invalidateQueries({ queryKey: ['contabilidad-periodo-vigente'] });
      setError(null);
      setMensajeCompletar(
        creados.length === 0
          ? 'Ya estaba al día — no hacía falta crear ningún período.'
          : `Se creó ${creados.length === 1 ? 'el período' : `${creados.length} período(s)`}: ${creados.map((p) => etiquetaPeriodo(p)).join(', ')}.`,
      );
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo completar los períodos faltantes.')),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <p>
          Los períodos (mensuales) se crean solos todos los días a las 7am, 5 días antes de fin de mes — no hace falta
          abrirlos a mano. Si por algún motivo no se creó el que cubre hoy (ej. el servidor estuvo caído esa ventana),
          usá el botón de al lado para crearlo sin esperar al cron. Cerrar el más antiguo todavía abierto traspasa su
          saldo neto de ingresos y gastos a Utilidades Retenidas, con un asiento automático, y deja firme ese mes —
          ya no se pueden crear asientos manuales ni gastos con fecha dentro de él.
        </p>
        {tienePermiso('contabilidad.cerrarperiodo') && (
          <Button
            variante="secundario"
            className="shrink-0"
            disabled={completarFaltantes.isPending}
            onClick={() => completarFaltantes.mutate()}
          >
            {completarFaltantes.isPending ? 'Revisando…' : 'Completar períodos faltantes'}
          </Button>
        )}
      </div>

      {mensajeCompletar && <p className="text-sm text-emerald-700 dark:text-emerald-400">{mensajeCompletar}</p>}
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
                          <Button variante="secundario" onClick={() => setPeriodoParaCerrar(p)}>
                            Cerrar
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

      {periodoParaCerrar && (
        <ConfirmModal
          titulo={`¿Cerrar ${etiquetaPeriodo(periodoParaCerrar)}?`}
          descripcion={<AsistentePrecierreChecklist periodoId={periodoParaCerrar.id} />}
          confirmarTexto="Cerrar de todas formas"
          peligro={false}
          confirmando={cerrar.isPending}
          onConfirmar={() => cerrar.mutate(periodoParaCerrar.id)}
          onCancelar={() => setPeriodoParaCerrar(null)}
        />
      )}
    </div>
  );
}
