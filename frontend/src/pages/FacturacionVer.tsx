import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { abrirBlob } from '../lib/descargar-archivo';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Tabs } from '../components/molecules/Tabs/Tabs';
import { ModalImprimir } from '../components/molecules/ModalImprimir/ModalImprimir';
import { ModalRegistrarCobro } from '../components/molecules/ModalRegistrarCobro/ModalRegistrarCobro';
import { TablaArticulosDocumento } from '../components/molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { PanelComentariosDocumento } from '../components/organisms/PanelComentariosDocumento/PanelComentariosDocumento';
import { BloqueTotalesDocumento } from '../components/molecules/BloqueTotalesDocumento/BloqueTotalesDocumento';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import {
  FacturaDetalle,
  Pago,
  TONO_POR_ESTADO,
  identificadorFactura,
  ModalAnularFactura,
  ModalLinkPago,
} from '../components/organisms/FacturasTable/factura-compartido';

/**
 * Auditoría UX (post Período Contable, 2026-11) — reemplaza a
 * `ModalDetalleFactura`: más información (cliente, vendedor, bodega,
 * forma de pago, comprobante completo, observaciones, motivo de
 * anulación, moneda/tasa si no es DOP, notas de crédito/débito con
 * detalle) y los botones de acción (Anular/Registrar cobro/Generar link
 * de pago/Imprimir/Descargar) en el panel lateral, siempre visibles —
 * antes vivían solo en el menú de la fila de la tabla, fuera del modal.
 */
export function FacturacionVer() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const [descargando, setDescargando] = useState(false);
  const [pestana, setPestana] = useState<'detalle' | 'pagos'>('detalle');
  const [imprimiendo, setImprimiendo] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [linkPago, setLinkPago] = useState(false);

  const { data: factura } = useQuery({
    queryKey: ['factura-detalle', id],
    queryFn: async () => (await apiClient.get<FacturaDetalle>(`/facturas/${id}`)).data,
  });
  const { data: pagosData } = useQuery({
    queryKey: ['pagos-factura', id],
    queryFn: async () => (await apiClient.get<{ pagos: Pago[]; totalPagado: number }>(`/facturas/${id}/pagos`)).data,
  });

  async function descargarPdf() {
    setDescargando(true);
    try {
      const respuesta = await apiClient.get(`/facturas/${id}/imprimir`, { responseType: 'blob' });
      abrirBlob(new Blob([respuesta.data], { type: String(respuesta.headers['content-type'] ?? 'application/pdf') }));
    } finally {
      setDescargando(false);
    }
  }

  const totalPagado = pagosData ? Number(pagosData.totalPagado) : 0;
  const totalRecargos = factura?.recargos.reduce((acc, r) => acc + Number(r.monto), 0) ?? 0;

  const puedeCobrar =
    !!factura && factura.tipoFactura === 'CREDITO' && factura.estado === 'EMITIDA' && !factura.pagada && tienePermiso('facturacion.cobrar');
  const puedeAnular = !!factura && factura.estado === 'EMITIDA' && tienePermiso('facturacion.anular');

  return (
    <RequierePermiso permiso="facturacion.ver">
      <PaginaDocumento
        titulo={factura ? `Factura ${identificadorFactura(factura)}` : 'Factura'}
        rutaVolver="/facturacion"
        etiquetaVolver="Volver a Facturación"
        haycambios={false}
        resumen={
          !factura ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
                <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{factura.cliente?.nombre}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{new Date(factura.fecha).toLocaleDateString('es-DO')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {Number(factura.total).toLocaleString('es-DO')}</span>
              </div>
              {factura.vendedor && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vendedor</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{factura.vendedor.nombre}</span>
                </div>
              )}
              {factura.bodega && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Bodega</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{factura.bodega.nombre}</span>
                </div>
              )}
              {factura.formaPago && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Forma de pago</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {factura.formaPago.nombre}
                    {factura.referenciaPago && ` — ${factura.referenciaPago}`}
                  </span>
                </div>
              )}
            </>
          )
        }
        acciones={
          <>
            <Button type="button" variante="secundario" className="w-full" onClick={descargarPdf} disabled={descargando}>
              {descargando ? 'Generando…' : 'Descargar PDF'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setImprimiendo(true)}>
              Imprimir / enviar por correo
            </Button>
            {puedeCobrar && (
              <>
                <Button type="button" className="w-full" onClick={() => setCobrando(true)}>
                  Registrar cobro
                </Button>
                <Button type="button" variante="secundario" className="w-full" onClick={() => setLinkPago(true)}>
                  Generar link de pago
                </Button>
              </>
            )}
            {puedeAnular && (
              <Button type="button" variante="peligro" className="w-full" onClick={() => setAnulando(true)}>
                Anular factura
              </Button>
            )}
          </>
        }
      >
        {!factura ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <>
            {factura.ncf && (
              <p className="font-mono text-sm text-slate-500 dark:text-slate-400">
                {factura.ncf}
                {factura.tipoNcf && ` (${factura.tipoNcf})`}
              </p>
            )}

            {factura.estado === 'ANULADA' && factura.motivoAnulacion && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                <span className="font-medium">Motivo de anulación: </span>
                {factura.motivoAnulacion}
              </div>
            )}

            {factura.moneda !== 'DOP' && factura.tasaCambio && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Moneda de presentación: {factura.moneda} — tasa de cambio al momento de la venta: {Number(factura.tasaCambio).toLocaleString('es-DO')}
                {factura.totalMoneda && ` — total ${factura.moneda} ${Number(factura.totalMoneda).toLocaleString('es-DO')}`}
              </p>
            )}

            {factura.observaciones && (
              <Card titulo="Observaciones">
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{factura.observaciones}</p>
              </Card>
            )}

            {factura.notasRelacionadas.length > 0 && (
              <Card titulo="Notas de crédito/débito aplicadas">
                <div className="space-y-2">
                  {factura.notasRelacionadas.map((n) => (
                    <div key={n.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">
                        {n.tipoFactura === 'NOTA_CREDITO' ? 'Nota de crédito' : 'Nota de débito'} {identificadorFactura(n)}
                        {' — '}
                        {new Date(n.fecha).toLocaleDateString('es-DO')}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">RD$ {Number(n.total).toLocaleString('es-DO')}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {pagosData && pagosData.pagos.length > 0 && (
              <Tabs
                pestanas={[
                  { id: 'detalle', etiqueta: 'Detalle' },
                  { id: 'pagos', etiqueta: 'Pagos' },
                ]}
                activa={pestana}
                onCambiar={setPestana}
              />
            )}

            {(pestana === 'detalle' || !pagosData || pagosData.pagos.length === 0) && (
              <>
                <TablaArticulosDocumento lineas={factura.lineas} />
                <BloqueTotalesDocumento
                  subtotal={factura.subtotal}
                  descuento={factura.descuento}
                  recargos={totalRecargos}
                  itbis={factura.itbis}
                  total={factura.total}
                />
              </>
            )}

            {pestana === 'pagos' && pagosData && pagosData.pagos.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Total</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">RD$ {Number(factura.total).toLocaleString('es-DO')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Pagado</p>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">RD$ {totalPagado.toLocaleString('es-DO')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Pendiente</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">RD$ {(Number(factura.total) - totalPagado).toLocaleString('es-DO')}</p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-2 font-medium">Fecha</th>
                        <th className="px-4 py-2 font-medium">Método</th>
                        <th className="px-4 py-2 text-right font-medium">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pagosData.pagos.map((pago) => (
                        <tr key={pago.id}>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{new Date(pago.fecha).toLocaleDateString('es-DO')}</td>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{pago.formaPago.nombre}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                            RD$ {Number(pago.monto).toLocaleString('es-DO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <PanelComentariosDocumento tipoDocumento="FACTURA" documentoId={factura.id} />
          </>
        )}
      </PaginaDocumento>

      {imprimiendo && factura && (
        <ModalImprimir urlBase={`/facturas/${factura.id}`} titulo={`Imprimir — ${identificadorFactura(factura)}`} onClose={() => setImprimiendo(false)} />
      )}
      {cobrando && factura && <ModalRegistrarCobro factura={factura} onClose={() => setCobrando(false)} />}
      {anulando && factura && (
        <ModalAnularFactura factura={factura} onClose={() => setAnulando(false)} onAnulada={() => navigate('/facturacion')} />
      )}
      {linkPago && factura && <ModalLinkPago factura={factura} onClose={() => setLinkPago(false)} />}
    </RequierePermiso>
  );
}
