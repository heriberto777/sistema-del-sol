import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
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
  sfsEmpleado: string;
  afpEmpleado: string;
  isr: string;
  otrasDeducciones: string;
  salarioNeto: string;
  sfsEmpleador: string;
  afpEmpleador: string;
  infotep: string;
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
    <div className="overflow-x-auto">
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

function ModalDetalleRecibo({ recibo, onClose }: { recibo: ReciboNomina; onClose: () => void }) {
  return (
    <Modal titulo={`Recibo — ${recibo.empleado.nombre}`} onClose={onClose}>
      <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
        <div className="flex justify-between"><span>Salario bruto</span><span>{formatoRD(recibo.salarioBruto)}</span></div>
        <div className="flex justify-between"><span>SFS (empleado)</span><span>{formatoRD(recibo.sfsEmpleado)}</span></div>
        <div className="flex justify-between"><span>AFP (empleado)</span><span>{formatoRD(recibo.afpEmpleado)}</span></div>
        <div className="flex justify-between"><span>ISR</span><span>{formatoRD(recibo.isr)}</span></div>
        <div className="flex justify-between"><span>Otras deducciones</span><span>{formatoRD(recibo.otrasDeducciones)}</span></div>
        <hr className="border-slate-200 dark:border-slate-800" />
        <div className="flex justify-between font-medium text-slate-900 dark:text-slate-100">
          <span>Salario neto</span><span>{formatoRD(recibo.salarioNeto)}</span>
        </div>
        <hr className="border-slate-200 dark:border-slate-800" />
        <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">Aportes patronales (no descontados del recibo)</p>
        <div className="flex justify-between"><span>SFS (patronal)</span><span>{formatoRD(recibo.sfsEmpleador)}</span></div>
        <div className="flex justify-between"><span>AFP (patronal)</span><span>{formatoRD(recibo.afpEmpleador)}</span></div>
        <div className="flex justify-between"><span>INFOTEP</span><span>{formatoRD(recibo.infotep)}</span></div>
      </div>
    </Modal>
  );
}

function PeriodoDetalle({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [verAportes, setVerAportes] = useState(false);
  const [reciboAbierto, setReciboAbierto] = useState<ReciboNomina | null>(null);
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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-1">Empleado</th>
              <th className="py-1">Salario bruto</th>
              <th className="py-1">Salario neto</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {data.recibos.map((recibo) => (
              <tr key={recibo.id}>
                <td className="py-1">{recibo.empleado.nombre}</td>
                <td className="py-1">{formatoRD(recibo.salarioBruto)}</td>
                <td className="py-1">{formatoRD(recibo.salarioNeto)}</td>
                <td className="py-1 text-right">
                  <button
                    type="button"
                    className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                    onClick={() => setReciboAbierto(recibo)}
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variante="secundario" onClick={() => setVerAportes((v) => !v)}>
        {verAportes ? 'Ocultar reporte de aportes (TSS/ISR)' : 'Ver reporte de aportes (TSS/ISR)'}
      </Button>
      {verAportes && <ReporteAportesView id={id} />}
      {reciboAbierto && <ModalDetalleRecibo recibo={reciboAbierto} onClose={() => setReciboAbierto(null)} />}
    </div>
  );
}

export function PeriodosNominaTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');

  const [tipo, setTipo] = useState<'QUINCENAL' | 'MENSUAL'>('MENSUAL');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['nomina-periodos', pagina, filtroEstado],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<PeriodoNomina>>('/nomina/periodos', {
          params: { pagina, estado: filtroEstado || undefined },
        })
      ).data,
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
        <Card titulo="Generar período" descripcion="Crea los recibos de todos los empleados activos para el rango elegido.">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as 'QUINCENAL' | 'MENSUAL')} className="!w-auto">
                <option value="MENSUAL">Mensual</option>
                <option value="QUINCENAL">Quincenal</option>
              </Select>
            </div>
            <FormField id="periodo-inicio" label="Fecha inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
            <FormField id="periodo-fin" label="Fecha fin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} required />
            <Button type="submit" disabled={generar.isPending}>
              {generar.isPending ? 'Generando…' : 'Generar período'}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </Card>
      )}

      {isLoading && <p className="text-sm text-slate-500">Cargando períodos…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los períodos.</p>}

      {data && (
        <Card
          sinPadding
          titulo="Períodos"
          descripcion={`${data.total} período(s)`}
          acciones={
            <Select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPagina(1);
              }}
              className="!w-auto"
            >
              <option value="">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="PROCESADO">Procesado</option>
              <option value="PAGADO">Pagado</option>
            </Select>
          }
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.datos.map((periodo) => (
              <div key={periodo.id}>
                <button
                  onClick={() => setExpandidoId(expandidoId === periodo.id ? null : periodo.id)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40"
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
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        </Card>
      )}
    </div>
  );
}
