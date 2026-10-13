import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { DashboardCrm, ETIQUETA_ESTADO_LEAD, EstadoLead } from '../../../types/crm';

function formatearMoneda(monto: number) {
  return `RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const ORDEN_EMBUDO: EstadoLead[] = ['NUEVO', 'CONTACTADO', 'CALIFICADO', 'CONVERTIDO', 'DESCARTADO'];

export function CrmDashboardPanel() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard', desde, hasta],
    queryFn: async () => (await apiClient.get<DashboardCrm>('/crm/reportes/dashboard', { params: { desde: desde || undefined, hasta: hasta || undefined } })).data,
  });

  const maxEmbudo = data ? Math.max(1, ...ORDEN_EMBUDO.map((e) => data.embudoLeads[e])) : 1;
  const maxForecast = data ? Math.max(1, ...data.forecastPorMes.map((f) => f.montoPonderado)) : 1;

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        contentClassName="flex flex-wrap items-end gap-3 p-4"
        titulo="Período"
        descripcion="Sin fechas, muestra el mes en curso."
      >
        <FormField id="dash-desde" label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <FormField id="dash-hasta" label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </Card>

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pipeline abierto</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatearMoneda(data.pipelineAbierto.montoTotal)}</p>
              <p className="text-xs text-slate-400">{data.pipelineAbierto.cantidad} oportunidad(es)</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ganadas en el período</p>
              <p className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatearMoneda(data.ganadas.montoTotal)}</p>
              <p className="text-xs text-slate-400">{data.ganadas.cantidad} oportunidad(es)</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasa de conversión</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {data.tasaConversion === null ? '—' : `${Math.round(data.tasaConversion * 100)}%`}
              </p>
              <p className="text-xs text-slate-400">{data.ganadas.cantidad + data.perdidas.cantidad} cerradas en total</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ciclo prom. de venta</p>
              <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {data.cicloPromedioDias === null ? '—' : `${Math.round(data.cicloPromedioDias)} días`}
              </p>
            </div>
          </div>

          <Card titulo="Embudo de Leads">
            <div className="flex flex-col gap-2">
              {ORDEN_EMBUDO.map((estado) => (
                <div key={estado} className="grid grid-cols-[120px_1fr_50px] items-center gap-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{ETIQUETA_ESTADO_LEAD[estado]}</span>
                  <div className="h-5 rounded bg-slate-100 dark:bg-slate-800">
                    <div
                      className={estado === 'DESCARTADO' ? 'h-full rounded bg-red-400' : 'h-full rounded bg-sol-500'}
                      style={{ width: `${(data.embudoLeads[estado] / maxEmbudo) * 100}%` }}
                    />
                  </div>
                  <span className="text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">{data.embudoLeads[estado]}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card titulo="Forecast ponderado por mes" descripcion="Monto estimado × probabilidad de cada etapa, oportunidades abiertas.">
            {data.forecastPorMes.length === 0 ? (
              <EstadoVacio titulo="Sin oportunidades abiertas" descripcion="No hay nada en el pipeline para proyectar todavía." />
            ) : (
              <div className="flex flex-col gap-2">
                {data.forecastPorMes.map((f) => (
                  <div key={f.mes} className="grid grid-cols-[90px_1fr_110px] items-center gap-3 text-sm">
                    <span className="font-mono text-slate-600 dark:text-slate-400">{f.mes}</span>
                    <div className="h-5 rounded bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded bg-slate-500" style={{ width: `${(f.montoPonderado / maxForecast) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">{formatearMoneda(f.montoPonderado)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card sinPadding titulo="Ranking de vendedores" descripcion="Oportunidades ganadas en el período.">
            {data.rankingVendedores.length === 0 ? (
              <div className="p-5">
                <EstadoVacio titulo="Sin ventas ganadas" descripcion="Todavía no hay oportunidades ganadas en este período." />
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Vendedor</th>
                    <th className="px-5 py-3 font-medium">Ganadas</th>
                    <th className="px-5 py-3 font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.rankingVendedores.map((v) => (
                    <tr key={v.vendedorId}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{v.nombre}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{v.cantidadGanadas}</td>
                      <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-300">{formatearMoneda(v.montoGanado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
