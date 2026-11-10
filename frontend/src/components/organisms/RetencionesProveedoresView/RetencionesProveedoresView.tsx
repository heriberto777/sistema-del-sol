import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Card } from '../../atoms/Card/Card';
import { StatCard } from '../../molecules/StatCard/StatCard';

interface RetencionProveedor {
  proveedorNombre: string;
  proveedorRnc: string;
  fecha: string;
  montoBruto: number;
  retencionIsr: number;
  retencionItbis: number;
  netoPagado: number;
}

interface RetencionesProveedores {
  filas: RetencionProveedor[];
  resumen: { cantidad: number; montoBruto: number; retencionIsr: number; retencionItbis: number; netoPagado: number };
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

/** Extraído de ReporteFiscalDgii (ver docs/ARCHITECTURE.md, auditoría de organización) — vive en Cuentas por Cobrar y Pagar, no en Finanzas, porque es retención practicada al pagarle a un proveedor. */
export function RetencionesProveedoresView() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data: retencionesProveedores } = useQuery({
    queryKey: ['reportes-fiscales-retenciones-proveedores', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<RetencionesProveedores>('/reportes-fiscales/retenciones-proveedores', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        ISR/ITBIS retenido a proveedores por servicios (Art. 309/349) al registrar el pago de una orden de compra —
        base para la declaración mensual de retenciones a terceros (IR-17), sin el layout oficial del formulario.
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

      {retencionesProveedores && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard etiqueta="Monto bruto" valor={formatoRD(retencionesProveedores.resumen.montoBruto)} />
            <StatCard etiqueta="ISR retenido" valor={formatoRD(retencionesProveedores.resumen.retencionIsr)} />
            <StatCard etiqueta="ITBIS retenido" valor={formatoRD(retencionesProveedores.resumen.retencionItbis)} />
            <StatCard etiqueta="Neto pagado" valor={formatoRD(retencionesProveedores.resumen.netoPagado)} />
          </div>
          <Card sinPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Proveedor</th>
                    <th className="px-5 py-3 font-medium">RNC</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 text-right font-medium">Monto bruto</th>
                    <th className="px-5 py-3 text-right font-medium">ISR retenido</th>
                    <th className="px-5 py-3 text-right font-medium">ITBIS retenido</th>
                    <th className="px-5 py-3 text-right font-medium">Neto pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {retencionesProveedores.filas.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.proveedorNombre}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{f.proveedorRnc || '—'}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{formatoRD(f.montoBruto)}</td>
                      <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{formatoRD(f.retencionIsr)}</td>
                      <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{formatoRD(f.retencionItbis)}</td>
                      <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">{formatoRD(f.netoPagado)}</td>
                    </tr>
                  ))}
                  {retencionesProveedores.filas.length === 0 && (
                    <tr>
                      <td className="px-5 py-3 text-slate-400" colSpan={7}>
                        Sin pagos con retención en el rango
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
