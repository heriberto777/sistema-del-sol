import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { documentosPublicosApiClient } from '../lib/documentos-publicos-api-client';
import { Button } from '../components/atoms/Button/Button';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';

interface LineaDocumentoPublico {
  concepto: string;
  cantidad: string;
  precioUnitario?: string;
  total?: string;
}

interface DocumentoPublico {
  tipoDocumento: string;
  numero: string;
  fecha: string;
  cliente: string;
  lineas: LineaDocumentoPublico[];
  subtotal?: number;
  descuento?: number;
  recargos?: { concepto: string; monto: number }[];
  itbis?: number;
  total?: number;
  totalEnMoneda?: { moneda: string; monto: number };
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Ítem H-4 — link público de solo lectura (sin sesión) para que el
 * cliente vea la Factura/Cotización real detrás del aviso de texto que
 * le llega por email/WhatsApp (antes no había forma de ver el documento,
 * solo el total en la notificación). Mismo criterio de "sin
 * interceptores" que `CobroFactura.tsx` — el UUID de la URL es el único
 * "acceso" que hace falta, no hay nada que pagar/confirmar acá, solo
 * mostrar + descargar PDF.
 */
function VerDocumentoPublico({ tipo }: { tipo: 'factura' | 'cotizacion' }) {
  const { id } = useParams<{ id: string }>();
  const segmento = tipo === 'factura' ? 'facturas' : 'cotizaciones';

  const { data: documento, isLoading, isError } = useQuery({
    queryKey: ['documento-publico', tipo, id],
    queryFn: async () => (await documentosPublicosApiClient.get<DocumentoPublico>(`/documentos-publicos/${segmento}/${id}`)).data,
  });

  return (
    <div className="relative flex min-h-screen items-start justify-center bg-slate-50 p-4 pt-12 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</h1>

        {isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
        {isError && <p className="text-sm text-red-600">No encontramos ese documento.</p>}

        {documento && (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {documento.tipoDocumento} {documento.numero}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {new Date(documento.fecha).toLocaleDateString('es-DO')} · {documento.cliente}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Cant.</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {documento.lineas.map((linea, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{linea.concepto}</td>
                      <td className="px-3 py-2">{linea.cantidad}</td>
                      <td className="px-3 py-2 text-right">{linea.total ? formatoRD(Number(linea.total)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
              {documento.subtotal !== undefined && (
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatoRD(documento.subtotal)}</span>
                </div>
              )}
              {!!documento.descuento && (
                <div className="flex justify-between">
                  <span>Descuento</span>
                  <span>{formatoRD(documento.descuento)}</span>
                </div>
              )}
              {documento.recargos?.map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span>{r.concepto}</span>
                  <span>{formatoRD(r.monto)}</span>
                </div>
              ))}
              {documento.itbis !== undefined && (
                <div className="flex justify-between">
                  <span>ITBIS</span>
                  <span>{formatoRD(documento.itbis)}</span>
                </div>
              )}
              {documento.total !== undefined && (
                <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100">
                  <span>Total</span>
                  <span>{formatoRD(documento.total)}</span>
                </div>
              )}
              {documento.totalEnMoneda && (
                <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                  Equivalente: {documento.totalEnMoneda.moneda}{' '}
                  {documento.totalEnMoneda.monto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <Button className="w-full" onClick={() => window.open(`/api/documentos-publicos/${segmento}/${id}/pdf`, '_blank')}>
              Descargar PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function VerFactura() {
  return <VerDocumentoPublico tipo="factura" />;
}

export function VerCotizacion() {
  return <VerDocumentoPublico tipo="cotizacion" />;
}
