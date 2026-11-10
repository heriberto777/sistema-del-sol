import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Card } from '../../atoms/Card/Card';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface RetencionEmpleado {
  cedula: string;
  nombre: string;
  salarioBruto: number;
  isr: number;
}

interface RetencionesNomina {
  empleados: RetencionEmpleado[];
  resumen: { salarioBruto: number; isr: number };
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

/** Extraído de ReporteFiscalDgii (ver docs/ARCHITECTURE.md, auditoría de organización) — vive en Nómina, no en Finanzas, porque es retención sobre el salario de los empleados. */
export function RetencionesNominaView() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: retenciones } = useQuery({
    queryKey: ['reportes-fiscales-retenciones-nomina', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<RetencionesNomina>('/reportes-fiscales/retenciones-nomina', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Base para la declaración mensual de retenciones de asalariados (IR-17) — montos reales por empleado, sin el layout oficial del formulario.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {retenciones && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard etiqueta="Salario bruto total" valor={formatoRD(retenciones.resumen.salarioBruto)} />
            <StatCard etiqueta="ISR retenido total" valor={formatoRD(retenciones.resumen.isr)} />
          </div>
          <Card sinPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Cédula</th>
                    <th className="px-5 py-3 font-medium">Nombre</th>
                    <th className="px-5 py-3 text-right font-medium">Salario bruto</th>
                    <th className="px-5 py-3 text-right font-medium">ISR retenido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {retenciones.empleados.map((e) => (
                    <tr key={e.cedula} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{e.cedula}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{e.nombre}</td>
                      <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{formatoRD(e.salarioBruto)}</td>
                      <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{formatoRD(e.isr)}</td>
                    </tr>
                  ))}
                  {retenciones.empleados.length === 0 && (
                    <tr>
                      <td className="px-5 py-3 text-slate-400" colSpan={4}>
                        Sin recibos de nómina en el rango
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
