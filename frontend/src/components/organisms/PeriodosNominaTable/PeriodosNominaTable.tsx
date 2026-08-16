import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

type EstadoPeriodo = 'BORRADOR' | 'PROCESADO' | 'PAGADO';

interface PeriodoNomina {
  id: string;
  tipo: 'QUINCENAL' | 'MENSUAL';
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodo;
}

interface ReciboNomina {
  id: string;
  salarioBruto: string;
  salarioNeto: string;
  empleado: { nombre: string };
}

interface PeriodoNominaDetalle extends PeriodoNomina {
  recibos: ReciboNomina[];
}

interface ReporteAportes {
  empleados: { empleadoId: string; cedula: string; nombre: string; sfsEmpleado: number; sfsEmpleador: number; afpEmpleado: number; afpEmpleador: number; infotep: number; isr: number }[];
  totales: { totalSfs: number; totalAfp: number; infotep: number; isr: number };
}

const TONO_POR_ESTADO: Record<EstadoPeriodo, 'neutro' | 'exito' | 'advertencia'> = {
  BORRADOR: 'neutro',
  PROCESADO: 'advertencia',
  PAGADO: 'exito',
};

function formatoRD(valor: string) {
  return `RD$ ${Number(valor).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

function ReporteAportesView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['nomina-periodo-reporte-aportes', id],
    queryFn: async () => (await apiClient.get<ReporteAportes>(`/nomina/periodos/${id}/reporte-aportes`)).data,
  });

  if (isLoading || !data) return <p className="py-2 text-sm text-slate-500">Calculando reporte de aportes…</p>;

  return (
    <div className="space-y-2">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500 dark:text-slate-400">
          <tr>
            <th className="py-1">Empleado</th>
            <th className="py-1">Cédula</th>
            <th className="py-1 text-right">SFS (emp. + patronal)</th>
            <th className="py-1 text-right">AFP (emp. + patronal)</th>
            <th className="py-1 text-right">INFOTEP</th>
            <th className="py-1 text-right">ISR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {data.empleados.map((e) => (
            <tr key={e.empleadoId}>
              <td className="py-1">{e.nombre}</td>
              <td className="py-1 font-mono text-xs">{e.cedula}</td>
              <td className="py-1 text-right">{formatoRD(String(e.sfsEmpleado + e.sfsEmpleador))}</td>
              <td className="py-1 text-right">{formatoRD(String(e.afpEmpleado + e.afpEmpleador))}</td>
              <td className="py-1 text-right">{formatoRD(String(e.infotep))}</td>
              <td className="py-1 text-right">{formatoRD(String(e.isr))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 font-medium dark:border-slate-800">
            <td className="py-1" colSpan={2}>
              Total a remitir
            </td>
            <td className="py-1 text-right">{formatoRD(String(data.totales.totalSfs))}</td>
            <td className="py-1 text-right">{formatoRD(String(data.totales.totalAfp))}</td>
            <td className="py-1 text-right">{formatoRD(String(data.totales.infotep))}</td>
            <td className="py-1 text-right">{formatoRD(String(data.totales.isr))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PeriodoDetalle({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [verAportes, setVerAportes] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['nomina-periodo', id],
    queryFn: async () => (await apiClient.get<PeriodoNominaDetalle>(`/nomina/periodos/${id}`)).data,
  });

  const procesar = useMutation({
    mutationFn: async () => apiClient.post(`/nomina/periodos/${id}/procesar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomina-periodo', id] });
      queryClient.invalidateQueries({ queryKey: ['nomina-periodos'] });
    },
  });

  const marcarPagado = useMutation({
    mutationFn: async () => apiClient.post(`/nomina/periodos/${id}/marcar-pagado`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nomina-periodo', id] });
      queryClient.invalidateQueries({ queryKey: ['nomina-periodos'] });
    },
  });

  if (isLoading || !data) return <p className="p-3 text-sm text-slate-500">Cargando período…</p>;

  return (
    <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      {tienePermiso('nomina.editar') && (
      <div className="flex gap-2">
        {data.estado === 'BORRADOR' && (
          <Button variante="secundario" onClick={() => procesar.mutate()} disabled={procesar.isPending}>
            {procesar.isPending ? 'Procesando…' : 'Procesar período'}
          </Button>
        )}
        {data.estado === 'PROCESADO' && (
          <Button onClick={() => marcarPagado.mutate()} disabled={marcarPagado.isPending}>
            {marcarPagado.isPending ? 'Marcando…' : 'Marcar como pagado'}
          </Button>
        )}
      </div>
      )}
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500 dark:text-slate-400">
          <tr>
            <th className="py-1">Empleado</th>
            <th className="py-1">Salario bruto</th>
            <th className="py-1">Salario neto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {data.recibos.map((recibo) => (
            <tr key={recibo.id}>
              <td className="py-1">{recibo.empleado.nombre}</td>
              <td className="py-1">{formatoRD(recibo.salarioBruto)}</td>
              <td className="py-1">{formatoRD(recibo.salarioNeto)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button variante="secundario" onClick={() => setVerAportes((v) => !v)}>
        {verAportes ? 'Ocultar reporte de aportes (TSS/ISR)' : 'Ver reporte de aportes (TSS/ISR)'}
      </Button>
      {verAportes && <ReporteAportesView id={id} />}
    </div>
  );
}

export function PeriodosNominaTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const [tipo, setTipo] = useState<'QUINCENAL' | 'MENSUAL'>('MENSUAL');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['nomina-periodos', pagina],
    queryFn: async () => (await apiClient.get<PaginaResultado<PeriodoNomina>>('/nomina/periodos', { params: { pagina } })).data,
  });

  const generar = useMutation({
    mutationFn: async () => apiClient.post('/nomina/periodos', { tipo, fechaInicio, fechaFin }),
    onSuccess: (respuesta) => {
      queryClient.invalidateQueries({ queryKey: ['nomina-periodos'] });
      setExpandidoId(respuesta.data.id);
      setFechaInicio('');
      setFechaFin('');
      setError(null);
    },
    onError: () => setError('No se pudo generar el período — confirmá que haya empleados activos.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    generar.mutate();
  }

  return (
    <div className="space-y-4">
      {tienePermiso('nomina.editar') && (
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'QUINCENAL' | 'MENSUAL')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="MENSUAL">Mensual</option>
            <option value="QUINCENAL">Quincenal</option>
          </select>
        </div>
        <FormField id="periodo-inicio" label="Fecha inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
        <FormField id="periodo-fin" label="Fecha fin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
        <Button type="submit" disabled={generar.isPending}>
          {generar.isPending ? 'Generando…' : 'Generar período'}
        </Button>
      </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-slate-500">Cargando períodos…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los períodos.</p>}

      {data && (
        <>
          <div className="space-y-2">
            {data.datos.map((periodo) => (
              <div key={periodo.id} className="rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setExpandidoId(expandidoId === periodo.id ? null : periodo.id)}
                  className="flex w-full items-center justify-between p-3 text-left text-sm"
                >
                  <span className="text-slate-900 dark:text-slate-100">
                    {periodo.tipo} — {new Date(periodo.fechaInicio).toLocaleDateString('es-DO')} a{' '}
                    {new Date(periodo.fechaFin).toLocaleDateString('es-DO')}
                  </span>
                  <Badge tono={TONO_POR_ESTADO[periodo.estado]}>{periodo.estado}</Badge>
                </button>
                {expandidoId === periodo.id && <PeriodoDetalle id={periodo.id} />}
              </div>
            ))}
          </div>
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        </>
      )}
    </div>
  );
}
