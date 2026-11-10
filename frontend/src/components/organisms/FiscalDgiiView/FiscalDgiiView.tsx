import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Input } from '../../atoms/Input/Input';
import { Button } from '../../atoms/Button/Button';
import { StatCard } from '../../molecules/StatCard/StatCard';
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

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

/**
 * Extraído de ReporteFiscalDgii (antes mezclaba esto + retenciones de nómina
 * + retenciones a proveedores en un solo componente dentro del hub de
 * Reportes) — ver docs/ARCHITECTURE.md, auditoría de organización. Retenciones
 * de nómina vive en RetencionesNominaView (Nómina), retenciones a
 * proveedores en RetencionesProveedoresView (Cuentas por Cobrar y Pagar).
 */
export function FiscalDgiiView() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [descargando, setDescargando] = useState<'606' | '607' | '608' | 'it1' | null>(null);

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

  async function descargarIT1Pdf() {
    setDescargando('it1');
    try {
      const respuesta = await apiClient.get('/reportes-fiscales/it-1/exportar', {
        params: { desde: desde || undefined, hasta: hasta || undefined },
        responseType: 'blob',
      });
      descargarBlob(respuesta.data, 'IT-1.pdf');
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
          <StatCard etiqueta="ITBIS en ventas (607)" valor={formatoRD(data.itbisEnVentas)} />
          <StatCard etiqueta="ITBIS en compras (606)" valor={formatoRD(data.itbisEnCompras)} />
          <StatCard etiqueta="ITBIS neto a pagar" valor={formatoRD(data.itbisNetoAPagar)} />
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
          Se presenta en la Oficina Virtual de la DGII — el PDF es un respaldo interno con estos mismos montos, no un archivo para subir.
        </p>
        {it1 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard etiqueta="ITBIS en ventas" valor={formatoRD(it1.itbisEnVentas)} />
            <StatCard etiqueta="ITBIS en compras" valor={formatoRD(it1.itbisEnCompras)} />
            <StatCard etiqueta="ITBIS a pagar" valor={formatoRD(it1.itbisAPagar)} />
            <StatCard etiqueta="Saldo a favor" valor={formatoRD(it1.itbisSaldoAFavor)} />
          </div>
        )}
        <Button variante="secundario" disabled={descargando !== null} onClick={descargarIT1Pdf}>
          {descargando === 'it1' ? 'Generando…' : 'Descargar PDF'}
        </Button>
      </div>
    </div>
  );
}
