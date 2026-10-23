import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentosPublicosApiClient } from '../lib/documentos-publicos-api-client';
import { Button } from '../components/atoms/Button/Button';
import { Modal } from '../components/molecules/Modal/Modal';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';
import { mensajeErrorApi } from '../lib/mensaje-error-api';

type CampoEmisorCliente = 'rnc' | 'direccion' | 'telefono';
type ColumnaLinea = 'cantidad' | 'precioUnitario' | 'total';
type FilaTotal = 'subtotal' | 'descuento' | 'itbis' | 'total';

interface LineaDocumentoPublico {
  concepto: string;
  cantidad: string;
  precioUnitario?: string;
  total?: string;
}

interface EmisorPublico {
  nombre: string;
  rnc?: string;
  direccion?: string;
  telefono?: string;
}

interface ClienteDatosExtraPublico {
  rnc?: string;
  direccion?: string;
  telefono?: string;
}

interface QrPublico {
  dataUri: string;
  etiqueta?: string;
}

interface FirmaPublico {
  etiqueta?: string;
  imagen?: string;
}

interface DocumentoPublico {
  tipoDocumento: string;
  numero: string;
  fecha: string;
  cliente: string;
  clienteDatosExtra?: ClienteDatosExtraPublico;
  lineas: LineaDocumentoPublico[];
  subtotal?: number;
  descuento?: number;
  recargos?: { concepto: string; monto: number }[];
  itbis?: number;
  total?: number;
  totalEnMoneda?: { moneda: string; monto: number };
  logo?: string;
  notas?: string;
  notaPie?: string;
  emisor?: EmisorPublico;
  colorAcento?: string;
  camposEmisorVisibles?: CampoEmisorCliente[];
  camposClienteVisibles?: CampoEmisorCliente[];
  columnasLinea?: ColumnaLinea[];
  totalesVisibles?: FilaTotal[];
  qr?: QrPublico;
  firma?: FirmaPublico;
  /** CRM "Cotización conectada" — solo viene para tipo "cotizacion", nunca para factura. */
  estado?: 'BORRADOR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA';
  motivoRechazo?: string;
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TODAS_COLUMNAS: ColumnaLinea[] = ['cantidad', 'precioUnitario', 'total'];
const ETIQUETA_COLUMNA: Record<ColumnaLinea, string> = { cantidad: 'Cant.', precioUnitario: 'Precio', total: 'Total' };

/** Mismo criterio de "sin configurar, se muestran todas" que `columnasActivas` en documento-pdf.ts, para que esta vista coincida con el PDF. */
function columnasActivas(columnasLinea: ColumnaLinea[] | undefined): ColumnaLinea[] {
  if (columnasLinea && columnasLinea.length > 0) return TODAS_COLUMNAS.filter((c) => columnasLinea.includes(c));
  return TODAS_COLUMNAS;
}

function valorColumna(linea: LineaDocumentoPublico, columna: ColumnaLinea): string {
  if (columna === 'cantidad') return linea.cantidad;
  if (columna === 'precioUnitario') return linea.precioUnitario ? formatoRD(Number(linea.precioUnitario)) : '—';
  return linea.total ? formatoRD(Number(linea.total)) : '—';
}

/** Mismo criterio que `emisorCampoVisible` en documento-pdf.ts: sin configurar, se muestran todos. */
function campoVisible(campos: CampoEmisorCliente[] | undefined, campo: CampoEmisorCliente, valor: string | undefined): boolean {
  return !!valor && (!campos || campos.length === 0 || campos.includes(campo));
}

/** Mismo criterio que `clienteCampoVisible`: sin configurar, no se muestra ninguno extra (solo el nombre, comportamiento de siempre). */
function campoClienteVisible(campos: CampoEmisorCliente[] | undefined, campo: CampoEmisorCliente, valor: string | undefined): boolean {
  return !!campos?.includes(campo) && !!valor;
}

function filaTotalVisible(totalesVisibles: FilaTotal[] | undefined, fila: FilaTotal, presente: boolean): boolean {
  if (!presente) return false;
  return !totalesVisibles || totalesVisibles.length === 0 || totalesVisibles.includes(fila);
}

/**
 * CRM "Cotización conectada" — botones Aprobar/Rechazar en el link
 * público de la cotización, sin login (mismo criterio de "UUID como
 * capability token" que el resto de esta página). ACEPTADA es el único
 * estado que ya no deja responder — RECHAZADA sigue abierta por si el
 * cliente cambia de opinión y aprueba después.
 */
function AccionesCotizacion({ id, estado, motivoRechazo }: { id: string; estado: DocumentoPublico['estado']; motivoRechazo?: string }) {
  const queryClient = useQueryClient();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const responder = useMutation({
    mutationFn: async (body: { decision: 'ACEPTADA' | 'RECHAZADA'; motivo?: string }) =>
      documentosPublicosApiClient.post(`/documentos-publicos/cotizaciones/${id}/responder`, body),
    onSuccess: () => {
      setRechazando(false);
      setMotivo('');
      queryClient.invalidateQueries({ queryKey: ['documento-publico', 'cotizacion', id] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar tu respuesta. Probá de nuevo en un momento.')),
  });

  if (estado === 'ACEPTADA') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300">
        Aprobaste esta cotización. Nuestro equipo te va a contactar para confirmar los detalles.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {estado === 'RECHAZADA' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ya habías rechazado esta cotización{motivoRechazo ? ` (${motivoRechazo})` : ''} — si cambiaste de opinión, podés aprobarla igual.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={responder.isPending}
          onClick={() => {
            setError(null);
            responder.mutate({ decision: 'ACEPTADA' });
          }}
        >
          {responder.isPending ? 'Enviando…' : 'Aprobar'}
        </Button>
        <Button className="flex-1" variante="secundario" disabled={responder.isPending} onClick={() => setRechazando(true)}>
          Rechazar
        </Button>
      </div>

      {rechazando && (
        <Modal titulo="Rechazar cotización" onClose={() => setRechazando(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">Contanos brevemente por qué, para que puedan ajustarla si hace falta.</p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              autoFocus
              placeholder="ej. El precio no nos cuadra, necesitamos otra cantidad…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variante="secundario" onClick={() => setRechazando(false)}>
                Cancelar
              </Button>
              <Button
                variante="peligro"
                disabled={responder.isPending || !motivo.trim()}
                onClick={() => {
                  setError(null);
                  responder.mutate({ decision: 'RECHAZADA', motivo: motivo.trim() });
                }}
              >
                {responder.isPending ? 'Enviando…' : 'Confirmar rechazo'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Ítem H-4 — link público de solo lectura (sin sesión) para que el
 * cliente vea la Factura/Cotización real detrás del aviso de texto que
 * le llega por email/WhatsApp (antes no había forma de ver el documento,
 * solo el total en la notificación). Mismo criterio de "sin
 * interceptores" que `CobroFactura.tsx` — el UUID de la URL es el único
 * "acceso" que hace falta, no hay nada que pagar/confirmar acá, solo
 * mostrar + descargar PDF.
 *
 * Respeta la misma personalización que el PDF (logo, color de marca,
 * campos de empresa/cliente, columnas, totales, QR, firma, texto legal)
 * — antes esta pantalla tenía todo fijo (hasta el nombre "El Sistema del
 * Sol" en vez del nombre real del negocio), desconectada de "Formato de
 * Documentos" (hallazgo real reportado por el usuario). La única pieza
 * que NO replica es el layout de bloques libres de la Fase C — eso
 * requeriría reimplementar el motor de posicionamiento en HTML; esta
 * vista usa siempre el orden estándar de secciones.
 */
function VerDocumentoPublico({ tipo }: { tipo: 'factura' | 'cotizacion' }) {
  const { id } = useParams<{ id: string }>();
  const segmento = tipo === 'factura' ? 'facturas' : 'cotizaciones';

  const { data: documento, isLoading, isError } = useQuery({
    queryKey: ['documento-publico', tipo, id],
    queryFn: async () => (await documentosPublicosApiClient.get<DocumentoPublico>(`/documentos-publicos/${segmento}/${id}`)).data,
  });

  const columnas = documento ? columnasActivas(documento.columnasLinea) : TODAS_COLUMNAS;
  const datosEmisorExtra = documento
    ? ([
        campoVisible(documento.camposEmisorVisibles, 'rnc', documento.emisor?.rnc) && `RNC: ${documento.emisor!.rnc}`,
        campoVisible(documento.camposEmisorVisibles, 'direccion', documento.emisor?.direccion) && documento.emisor!.direccion,
        campoVisible(documento.camposEmisorVisibles, 'telefono', documento.emisor?.telefono) && `Tel: ${documento.emisor!.telefono}`,
      ].filter(Boolean) as string[])
    : [];
  const datosClienteExtra = documento
    ? ([
        campoClienteVisible(documento.camposClienteVisibles, 'rnc', documento.clienteDatosExtra?.rnc) && `RNC/Céd.: ${documento.clienteDatosExtra!.rnc}`,
        campoClienteVisible(documento.camposClienteVisibles, 'direccion', documento.clienteDatosExtra?.direccion) && documento.clienteDatosExtra!.direccion,
        campoClienteVisible(documento.camposClienteVisibles, 'telefono', documento.clienteDatosExtra?.telefono) && `Tel: ${documento.clienteDatosExtra!.telefono}`,
      ].filter(Boolean) as string[])
    : [];

  return (
    <div className="relative flex min-h-screen items-start justify-center bg-slate-50 p-4 pt-12 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
        {isError && <p className="text-sm text-red-600 dark:text-red-400">No encontramos ese documento.</p>}

        {documento && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {documento.logo && <img src={documento.logo} alt="" className="h-12 w-12 shrink-0 rounded object-contain" />}
              <div>
                <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400" style={documento.colorAcento ? { color: documento.colorAcento } : undefined}>
                  {documento.emisor?.nombre || 'Documento'}
                </h1>
                {datosEmisorExtra.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{datosEmisorExtra.join(' · ')}</p>}
              </div>
            </div>

            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {documento.tipoDocumento} {documento.numero}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {new Date(documento.fecha).toLocaleDateString('es-DO')} · {documento.cliente}
              </p>
              {datosClienteExtra.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{datosClienteExtra.join(' · ')}</p>}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Concepto</th>
                    {columnas.map((c) => (
                      <th key={c} className={c === 'cantidad' ? 'px-3 py-2' : 'px-3 py-2 text-right'}>
                        {ETIQUETA_COLUMNA[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {documento.lineas.map((linea, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{linea.concepto}</td>
                      {columnas.map((c) => (
                        <td key={c} className={c === 'cantidad' ? 'px-3 py-2' : 'px-3 py-2 text-right'}>
                          {valorColumna(linea, c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
              {filaTotalVisible(documento.totalesVisibles, 'subtotal', documento.subtotal !== undefined) && (
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatoRD(documento.subtotal!)}</span>
                </div>
              )}
              {filaTotalVisible(documento.totalesVisibles, 'descuento', !!documento.descuento) && (
                <div className="flex justify-between">
                  <span>Descuento</span>
                  <span>{formatoRD(documento.descuento!)}</span>
                </div>
              )}
              {documento.recargos?.map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span>{r.concepto}</span>
                  <span>{formatoRD(r.monto)}</span>
                </div>
              ))}
              {filaTotalVisible(documento.totalesVisibles, 'itbis', documento.itbis !== undefined) && (
                <div className="flex justify-between">
                  <span>ITBIS</span>
                  <span>{formatoRD(documento.itbis!)}</span>
                </div>
              )}
              {filaTotalVisible(documento.totalesVisibles, 'total', documento.total !== undefined) && (
                <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100" style={documento.colorAcento ? { color: documento.colorAcento } : undefined}>
                  <span>Total</span>
                  <span>{formatoRD(documento.total!)}</span>
                </div>
              )}
              {documento.totalEnMoneda && (
                <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                  Equivalente: {documento.totalEnMoneda.moneda}{' '}
                  {documento.totalEnMoneda.monto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {(documento.qr || documento.firma) && (
              <div className="flex flex-wrap items-start gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                {documento.qr && (
                  <div className="text-center">
                    <img src={documento.qr.dataUri} alt="Código QR" className="h-20 w-20 rounded border border-slate-200 dark:border-slate-700" />
                    {documento.qr.etiqueta && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{documento.qr.etiqueta}</p>}
                  </div>
                )}
                {documento.firma && (
                  <div className="flex-1">
                    {documento.firma.imagen && <img src={documento.firma.imagen} alt="Firma" className="h-10 object-contain" />}
                    <div className="mt-1 w-40 border-t border-slate-400 pt-1 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
                      {documento.firma.etiqueta || 'Autorizado por'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {documento.notas && (
              <p className="border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <span className="font-medium">Observaciones: </span>
                {documento.notas}
              </p>
            )}

            {documento.notaPie && <p className="border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">{documento.notaPie}</p>}

            {tipo === 'cotizacion' && id && <AccionesCotizacion id={id} estado={documento.estado} motivoRechazo={documento.motivoRechazo} />}

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
