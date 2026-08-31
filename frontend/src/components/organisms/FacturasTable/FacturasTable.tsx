import { FormEvent, useState } from 'react';
import { Eye } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { abrirBlob } from '../../../lib/descargar-archivo';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { ModalRegistrarCobro } from '../../molecules/ModalRegistrarCobro/ModalRegistrarCobro';
import { CampoPin } from '../../molecules/CampoPin/CampoPin';
import { CampoCodigoAutorizacion } from '../../molecules/CampoCodigoAutorizacion/CampoCodigoAutorizacion';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { TablaArticulosDocumento } from '../../molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { BloqueTotalesDocumento } from '../../molecules/BloqueTotalesDocumento/BloqueTotalesDocumento';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Factura {
  id: string;
  numero: string | null;
  ncf: string | null;
  tipoFactura: 'CONTADO' | 'CREDITO' | 'NOTA_DEBITO' | 'NOTA_CREDITO';
  estado: 'BORRADOR' | 'EMITIDA' | 'ANULADA';
  total: string;
  pagada: boolean;
  fecha: string;
  cliente: { nombre: string };
}

interface FacturaDetalle extends Factura {
  subtotal: string;
  descuento: string;
  itbis: string;
  recargos: { concepto: string; monto: string }[];
  lineas: { producto: { nombre: string } | null; descripcionManual: string | null; cantidad: string; precioUnitario: string; montoTotal: string }[];
}

interface Pago {
  id: string;
  monto: string;
  formaPago: { nombre: string };
  fecha: string;
}

const TONO_POR_ESTADO: Record<Factura['estado'], 'exito' | 'neutro' | 'peligro'> = {
  EMITIDA: 'exito',
  BORRADOR: 'neutro',
  ANULADA: 'peligro',
};

/**
 * Identificador para mostrar/usar en títulos — número interno de empresa
 * primero (distinto del NCF, que es el comprobante fiscal), con
 * fallback a NCF y, para facturas viejas sin ninguno de los dos
 * (backfill no corrido), al id.
 */
function identificadorFactura(factura: Pick<Factura, 'numero' | 'ncf' | 'id'>): string {
  return factura.numero ?? factura.ncf ?? factura.id.slice(0, 8);
}

interface FacturasTableProps {
  /** Filtra por tipo (ej. ['NOTA_CREDITO', 'NOTA_DEBITO']) — usado por la pantalla de Notas (Fase 4a). Sin esto, trae todos los tipos. */
  tiposFactura?: Factura['tipoFactura'][];
  titulo?: string;
  busquedaPlaceholder?: string;
}

export function FacturasTable({ tiposFactura, titulo = 'Facturas', busquedaPlaceholder = 'Buscar por NCF o cliente…' }: FacturasTableProps = {}) {
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [facturaCobrando, setFacturaCobrando] = useState<Factura | null>(null);
  const [facturaAnulando, setFacturaAnulando] = useState<Factura | null>(null);
  const [facturaImprimiendo, setFacturaImprimiendo] = useState<Factura | null>(null);
  const [facturaLinkPago, setFacturaLinkPago] = useState<Factura | null>(null);
  const [facturaViendo, setFacturaViendo] = useState<Factura | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['facturas', pagina, busquedaDebounced, tiposFactura],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Factura>>('/facturas', {
          params: { pagina, busqueda: busquedaDebounced || undefined, tipoFactura: tiposFactura },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">No se pudieron cargar las facturas.</p>}

      <Card
        sinPadding
        titulo={titulo}
        descripcion={data ? `${data.total} factura(s)` : undefined}
        acciones={
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder={busquedaPlaceholder}
          />
        }
      >
        {isLoading && <p className="p-5 text-sm text-slate-500">Cargando facturas…</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-5 py-3 font-medium">NCF</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((factura) => {
                  const acciones = [
                    { etiqueta: 'Imprimir', onClick: () => setFacturaImprimiendo(factura) },
                    ...(factura.tipoFactura === 'CREDITO' &&
                    factura.estado === 'EMITIDA' &&
                    !factura.pagada &&
                    tienePermiso('facturacion.cobrar')
                      ? [
                          { etiqueta: 'Registrar cobro', onClick: () => setFacturaCobrando(factura) },
                          { etiqueta: 'Generar link de pago', onClick: () => setFacturaLinkPago(factura) },
                        ]
                      : []),
                    ...(factura.estado === 'EMITIDA' && tienePermiso('facturacion.anular')
                      ? [{ etiqueta: 'Anular', onClick: () => setFacturaAnulando(factura), tono: 'peligro' as const }]
                      : []),
                  ];

                  return (
                    <tr
                      key={factura.id}
                      onClick={() => setFacturaViendo(factura)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                        {identificadorFactura(factura)}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{factura.ncf ?? '—'}</td>
                      <td className="px-5 py-3">{factura.cliente?.nombre}</td>
                      <td className="px-5 py-3">{factura.tipoFactura}</td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(factura.total).toLocaleString('es-DO')}</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
                        {factura.tipoFactura === 'CREDITO' && factura.estado === 'EMITIDA' && (
                          <span className="ml-2 text-xs text-slate-400">{factura.pagada ? 'pagada' : 'pendiente de cobro'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">{new Date(factura.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setFacturaViendo(factura)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            aria-label="Ver detalle"
                            title="Ver detalle"
                          >
                            <Eye size={16} />
                          </button>
                          {acciones.length > 0 && <RowActionsMenu acciones={acciones} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {facturaCobrando && <ModalRegistrarCobro factura={facturaCobrando} onClose={() => setFacturaCobrando(null)} />}
      {facturaAnulando && <ModalAnularFactura factura={facturaAnulando} onClose={() => setFacturaAnulando(null)} />}
      {facturaLinkPago && <ModalLinkPago factura={facturaLinkPago} onClose={() => setFacturaLinkPago(null)} />}
      {facturaImprimiendo && (
        <ModalImprimir
          urlBase={`/facturas/${facturaImprimiendo.id}`}
          titulo={`Imprimir — ${identificadorFactura(facturaImprimiendo)}`}
          onClose={() => setFacturaImprimiendo(null)}
        />
      )}
      {facturaViendo && (
        <ModalDetalleFactura
          factura={facturaViendo}
          onClose={() => setFacturaViendo(null)}
          onImprimir={() => {
            setFacturaImprimiendo(facturaViendo);
            setFacturaViendo(null);
          }}
        />
      )}
    </div>
  );
}

function ModalDetalleFactura({ factura, onClose, onImprimir }: { factura: Factura; onClose: () => void; onImprimir: () => void }) {
  const [descargando, setDescargando] = useState(false);

  const { data: detalle } = useQuery({
    queryKey: ['factura-detalle', factura.id],
    queryFn: async () => (await apiClient.get<FacturaDetalle>(`/facturas/${factura.id}`)).data,
  });
  const { data: pagosData } = useQuery({
    queryKey: ['pagos-factura', factura.id],
    queryFn: async () => (await apiClient.get<{ pagos: Pago[]; totalPagado: number }>(`/facturas/${factura.id}/pagos`)).data,
  });

  async function descargarPdf() {
    setDescargando(true);
    try {
      const respuesta = await apiClient.get(`/facturas/${factura.id}/imprimir`, { responseType: 'blob' });
      abrirBlob(new Blob([respuesta.data], { type: String(respuesta.headers['content-type'] ?? 'application/pdf') }));
    } finally {
      setDescargando(false);
    }
  }

  const totalPagado = pagosData ? Number(pagosData.totalPagado) : 0;
  const totalRecargos = detalle?.recargos.reduce((acc, r) => acc + Number(r.monto), 0) ?? 0;

  return (
    <Modal titulo={`Factura ${identificadorFactura(factura)}`} onClose={onClose} ancho="2xl">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
            {factura.ncf && <p className="font-mono text-sm text-slate-500 dark:text-slate-400">{factura.ncf}</p>}
          </div>
          <p className="text-right text-sm text-slate-500 dark:text-slate-400">
            Fecha
            <br />
            <span className="font-medium text-slate-900 dark:text-slate-100">{new Date(factura.fecha).toLocaleDateString('es-DO')}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variante="secundario" onClick={descargarPdf} disabled={descargando}>
            {descargando ? 'Generando…' : 'Descargar PDF'}
          </Button>
          <Button type="button" variante="secundario" onClick={onImprimir}>
            Imprimir / enviar por correo
          </Button>
        </div>

        {!detalle ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <>
            <TablaArticulosDocumento lineas={detalle.lineas} />
            <BloqueTotalesDocumento
              subtotal={detalle.subtotal}
              descuento={detalle.descuento}
              recargos={totalRecargos}
              itbis={detalle.itbis}
              total={detalle.total}
            />
          </>
        )}

        {pagosData && pagosData.pagos.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Pagos</p>
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
      </div>
    </Modal>
  );
}

function ModalAnularFactura({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [pin, setPin] = useState('');
  const [codigoAutorizacion, setCodigoAutorizacion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const anular = useMutation({
    mutationFn: async () =>
      apiClient.post(`/facturas/${factura.id}/anular`, { motivo, pin: pin || undefined, codigoAutorizacion: codigoAutorizacion || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
    onError: (err: unknown) => {
      const mensaje =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(mensaje ?? 'No se pudo anular la factura.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (motivo.trim().length < 3) {
      setError('Indicá un motivo de al menos 3 caracteres.');
      return;
    }
    if (!confirmado) {
      setError('Confirmá que querés anular esta factura antes de continuar.');
      return;
    }
    anular.mutate();
  }

  return (
    <Modal titulo={`Anular factura — ${identificadorFactura(factura)}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Esta acción es irreversible: la factura quedará anulada y, si corresponde, se reintegrará el inventario.
        </p>
        <FormField id="anular-motivo" label="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
          Confirmo que quiero anular esta factura.
        </label>
        <CampoPin value={pin} onChange={setPin} id="anular-pin" />
        <CampoCodigoAutorizacion
          requerido={usuario?.requiereAutorizacionAnular}
          solicitarUrl={`/facturas/${factura.id}/solicitar-autorizacion`}
          value={codigoAutorizacion}
          onChange={setCodigoAutorizacion}
          id="anular-codigo-autorizacion"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variante="peligro" disabled={anular.isPending} className="w-full">
          {anular.isPending ? 'Anulando…' : 'Anular factura'}
        </Button>
      </form>
    </Modal>
  );
}


/**
 * El link se arma 100% en el frontend (`/pagar-factura/:facturaId`
 * resuelve todo por su cuenta — monto, pasarela activa, checkout) — no
 * hace falta ningún endpoint para "generarlo" (ítem C-1).
 */
function ModalLinkPago({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/pagar-factura/${factura.id}`;

  return (
    <Modal titulo={`Link de pago — ${identificadorFactura(factura)}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Compartí este link con el cliente para que pague esta factura en línea con tarjeta. Si el negocio no tiene una pasarela de pago
          configurada (Admin → Facturación → Pasarela de pago), el link se lo va a indicar al cliente.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">{link}</code>
          <Button
            type="button"
            variante="secundario"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopiado(true);
            }}
          >
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <Button onClick={onClose} className="w-full">
          Listo
        </Button>
      </div>
    </Modal>
  );
}
