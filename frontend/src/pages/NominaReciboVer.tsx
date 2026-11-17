import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';

interface ReciboNomina {
  id: string;
  salarioBruto: string;
  sfsEmpleado: string;
  afpEmpleado: string;
  isr: string;
  otrasDeducciones: string;
  descuentoAusencias: string;
  montoHorasExtra: string;
  salarioNeto: string;
  sfsEmpleador: string;
  afpEmpleador: string;
  infotep: string;
  empleado: { nombre: string };
}

interface PeriodoNominaDetalle {
  id: string;
  recibos: ReciboNomina[];
}

function formatoRD(valor: string) {
  return `RD$ ${Number(valor).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Recibo" de PeriodosNominaTable.tsx. Sin endpoint propio de recibo individual: carga el período y busca el recibo adentro. */
export function NominaReciboVer() {
  const { periodoId, reciboId } = useParams<{ periodoId: string; reciboId: string }>();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['nomina-periodo', periodoId],
    queryFn: async () => (await apiClient.get<PeriodoNominaDetalle>(`/nomina/periodos/${periodoId}`)).data,
  });

  const recibo = data?.recibos.find((r) => r.id === reciboId);

  return (
    <PaginaDocumento
      titulo={recibo ? `Recibo — ${recibo.empleado.nombre}` : 'Recibo de nómina'}
      rutaVolver="/nomina/periodos"
      etiquetaVolver="Volver a Períodos de nómina"
      haycambios={false}
      resumen={
        recibo ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Salario neto</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatoRD(recibo.salarioNeto)}</span>
          </div>
        ) : null
      }
      acciones={
        <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/nomina/periodos')}>
          Volver
        </Button>
      }
    >
      {!recibo ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <Card titulo="Detalle del recibo">
          <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            <div className="flex justify-between">
              <span>Salario bruto</span>
              <span>{formatoRD(recibo.salarioBruto)}</span>
            </div>
            <div className="flex justify-between">
              <span>SFS (empleado)</span>
              <span>{formatoRD(recibo.sfsEmpleado)}</span>
            </div>
            <div className="flex justify-between">
              <span>AFP (empleado)</span>
              <span>{formatoRD(recibo.afpEmpleado)}</span>
            </div>
            <div className="flex justify-between">
              <span>ISR</span>
              <span>{formatoRD(recibo.isr)}</span>
            </div>
            <div className="flex justify-between">
              <span>Otras deducciones</span>
              <span>{formatoRD(recibo.otrasDeducciones)}</span>
            </div>
            {Number(recibo.descuentoAusencias) > 0 && (
              <div className="flex justify-between">
                <span>Descuento por ausencias</span>
                <span>{formatoRD(recibo.descuentoAusencias)}</span>
              </div>
            )}
            {Number(recibo.montoHorasExtra) > 0 && (
              <div className="flex justify-between">
                <span>Horas extra</span>
                <span>{formatoRD(recibo.montoHorasExtra)}</span>
              </div>
            )}
            <hr className="border-slate-200 dark:border-slate-800" />
            <div className="flex justify-between font-medium text-slate-900 dark:text-slate-100">
              <span>Salario neto</span>
              <span>{formatoRD(recibo.salarioNeto)}</span>
            </div>
            <hr className="border-slate-200 dark:border-slate-800" />
            <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">Aportes patronales (no descontados del recibo)</p>
            <div className="flex justify-between">
              <span>SFS (patronal)</span>
              <span>{formatoRD(recibo.sfsEmpleador)}</span>
            </div>
            <div className="flex justify-between">
              <span>AFP (patronal)</span>
              <span>{formatoRD(recibo.afpEmpleador)}</span>
            </div>
            <div className="flex justify-between">
              <span>INFOTEP</span>
              <span>{formatoRD(recibo.infotep)}</span>
            </div>
          </div>
        </Card>
      )}
    </PaginaDocumento>
  );
}
