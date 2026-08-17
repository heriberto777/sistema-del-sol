import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Button } from '../../atoms/Button/Button';
import { descargarBlob } from '../../../lib/descargar-archivo';

interface ResumenItbis {
  itbisEnVentas: number;
  itbisEnCompras: number;
  itbisNetoAPagar: number;
}

interface FormatoIT1 {
  itbisEnVentas: number;
  itbisEnCompras: number;
  itbisAPagar: number;
  itbisSaldoAFavor: number;
}

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

export function ReporteFiscalDgii() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [descargando, setDescargando] = useState<'606' | '607' | '608' | null>(null);

  const { data } = useQuery({
    queryKey: ['reportes-fiscales-itbis-resumen', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<ResumenItbis>('/reportes-fiscales/itbis-resumen', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  const { data: it1 } = useQuery({
    queryKey: ['reportes-fiscales-it1', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<FormatoIT1>('/reportes-fiscales/it-1', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  const { data: retenciones } = useQuery({
    queryKey: ['reportes-fiscales-retenciones-nomina', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<RetencionesNomina>('/reportes-fiscales/retenciones-nomina', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  const { data: retencionesProveedores } = useQuery({
    queryKey: ['reportes-fiscales-retenciones-proveedores', desde, hasta],
    queryFn: async () =>
      (
        await apiClient.get<RetencionesProveedores>('/reportes-fiscales/retenciones-proveedores', {
          params: { desde: desde || undefined, hasta: hasta || undefined },
        })
      ).data,
  });

  async function descargarTxt(formato: '606' | '607' | '608') {
    setDescargando(formato);
    try {
      const respuesta = await apiClient.get(`/reportes-fiscales/${formato}/exportar`, {
        params: { desde: desde || undefined, hasta: hasta || undefined },
        responseType: 'blob',
      });
      descargarBlob(respuesta.data, `DGII_${formato}.txt`);
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        Formato preliminar: verificá el archivo contra la herramienta de pre-validación de la
        Oficina Virtual de la DGII antes de remitirlo — el layout exacto no se pudo confirmar
        byte a byte contra la especificación oficial (ver ARCHITECTURE.md).
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

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Resumen etiqueta="ITBIS en ventas (607)" valor={data.itbisEnVentas} />
          <Resumen etiqueta="ITBIS en compras (606)" valor={data.itbisEnCompras} />
          <Resumen etiqueta="ITBIS neto a pagar" valor={data.itbisNetoAPagar} />
        </div>
      )}

      <div className="flex gap-2">
        <Button variante="secundario" disabled={descargando !== null} onClick={() => descargarTxt('606')}>
          {descargando === '606' ? 'Generando…' : 'Descargar 606 (compras)'}
        </Button>
        <Button variante="secundario" disabled={descargando !== null} onClick={() => descargarTxt('607')}>
          {descargando === '607' ? 'Generando…' : 'Descargar 607 (ventas)'}
        </Button>
        <Button variante="secundario" disabled={descargando !== null} onClick={() => descargarTxt('608')}>
          {descargando === '608' ? 'Generando…' : 'Descargar 608 (anulados)'}
        </Button>
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="font-medium text-slate-900 dark:text-slate-100">IT-1 — Declaración jurada de ITBIS</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Resumen para completar en la Oficina Virtual de la DGII — se presenta ahí, no como archivo.
        </p>
        {it1 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Resumen etiqueta="ITBIS en ventas" valor={it1.itbisEnVentas} />
            <Resumen etiqueta="ITBIS en compras" valor={it1.itbisEnCompras} />
            <Resumen etiqueta="ITBIS a pagar" valor={it1.itbisAPagar} />
            <Resumen etiqueta="Saldo a favor" valor={it1.itbisSaldoAFavor} />
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="font-medium text-slate-900 dark:text-slate-100">Retenciones de ISR sobre nómina (asalariados)</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Base para la declaración mensual de retenciones de asalariados — montos reales por empleado, sin el layout oficial del formulario.
        </p>
        {retenciones && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Resumen etiqueta="Salario bruto total" valor={retenciones.resumen.salarioBruto} />
              <Resumen etiqueta="ISR retenido total" valor={retenciones.resumen.isr} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Cédula</th>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2 text-right">Salario bruto</th>
                    <th className="px-4 py-2 text-right">ISR retenido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {retenciones.empleados.map((e) => (
                    <tr key={e.cedula}>
                      <td className="px-4 py-2 font-mono text-xs">{e.cedula}</td>
                      <td className="px-4 py-2">{e.nombre}</td>
                      <td className="px-4 py-2 text-right">{formatoRD(e.salarioBruto)}</td>
                      <td className="px-4 py-2 text-right">{formatoRD(e.isr)}</td>
                    </tr>
                  ))}
                  {retenciones.empleados.length === 0 && (
                    <tr>
                      <td className="px-4 py-2 text-slate-400" colSpan={4}>
                        Sin recibos de nómina en el rango
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="font-medium text-slate-900 dark:text-slate-100">Retenciones a proveedores (servicios)</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ISR/ITBIS retenido a proveedores por servicios (Art. 309/349) al registrar el pago de una orden de compra —
          base para la declaración mensual de retenciones a terceros, sin el layout oficial del formulario.
        </p>
        {retencionesProveedores && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Resumen etiqueta="Monto bruto" valor={retencionesProveedores.resumen.montoBruto} />
              <Resumen etiqueta="ISR retenido" valor={retencionesProveedores.resumen.retencionIsr} />
              <Resumen etiqueta="ITBIS retenido" valor={retencionesProveedores.resumen.retencionItbis} />
              <Resumen etiqueta="Neto pagado" valor={retencionesProveedores.resumen.netoPagado} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Proveedor</th>
                    <th className="px-4 py-2">RNC</th>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2 text-right">Monto bruto</th>
                    <th className="px-4 py-2 text-right">ISR retenido</th>
                    <th className="px-4 py-2 text-right">ITBIS retenido</th>
                    <th className="px-4 py-2 text-right">Neto pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {retencionesProveedores.filas.map((f, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{f.proveedorNombre}</td>
                      <td className="px-4 py-2 font-mono text-xs">{f.proveedorRnc || '—'}</td>
                      <td className="px-4 py-2">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-4 py-2 text-right">{formatoRD(f.montoBruto)}</td>
                      <td className="px-4 py-2 text-right">{formatoRD(f.retencionIsr)}</td>
                      <td className="px-4 py-2 text-right">{formatoRD(f.retencionItbis)}</td>
                      <td className="px-4 py-2 text-right">{formatoRD(f.netoPagado)}</td>
                    </tr>
                  ))}
                  {retencionesProveedores.filas.length === 0 && (
                    <tr>
                      <td className="px-4 py-2 text-slate-400" colSpan={7}>
                        Sin pagos con retención en el rango
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        RD$ {valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
