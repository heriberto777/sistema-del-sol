import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { CampoPin } from '../../molecules/CampoPin/CampoPin';
import { CampoCodigoAutorizacion } from '../../molecules/CampoCodigoAutorizacion/CampoCodigoAutorizacion';
import { useAuth } from '../../../hooks/useAuth';
import type { ClienteBasico } from '@backend-src/common/prisma/cliente-select-basico';
import type { PagoHistoricoBasico } from '@backend-src/common/prisma/pago-historico-basico';

/**
 * Compartido entre `FacturasTable` (listado) y `FacturacionVer` (página de
 * detalle, antes `ModalDetalleFactura`) — mismo tipo de documento, dos
 * puntos de entrada distintos a las mismas acciones (Anular/Link de pago).
 */
export interface Factura {
  id: string;
  numero: string | null;
  ncf: string | null;
  tipoFactura: 'CONTADO' | 'CREDITO' | 'NOTA_DEBITO' | 'NOTA_CREDITO';
  estado: 'BORRADOR' | 'EMITIDA' | 'ANULADA';
  total: string;
  pagada: boolean;
  fecha: string;
  cliente: ClienteBasico;
  tieneNotaAplicada: boolean;
}

export interface FacturaDetalle extends Factura {
  subtotal: string;
  descuento: string;
  itbis: string;
  tipoNcf: string | null;
  moneda: string;
  tasaCambio: string | null;
  totalMoneda: string | null;
  observaciones: string | null;
  motivoAnulacion: string | null;
  referenciaPago: string | null;
  plazoPagoDias: number;
  createdAt: string;
  vendedor: { nombre: string } | null;
  bodega: { nombre: string } | null;
  formaPago: { nombre: string } | null;
  notasRelacionadas: { id: string; numero: string | null; ncf: string | null; tipoFactura: string; total: string; fecha: string }[];
  recargos: { concepto: string; monto: string }[];
  lineas: {
    producto: { nombre: string } | null;
    descripcionManual: string | null;
    unidadMedida: { nombre: string } | null;
    cantidad: string;
    precioUnitario: string;
    montoTotal: string;
  }[];
}

export type Pago = PagoHistoricoBasico;

export const TONO_POR_ESTADO: Record<Factura['estado'], 'exito' | 'neutro' | 'peligro'> = {
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
export function identificadorFactura(factura: Pick<Factura, 'numero' | 'ncf' | 'id'>): string {
  return factura.numero ?? factura.ncf ?? factura.id.slice(0, 8);
}

export function ModalAnularFactura({ factura, onClose, onAnulada }: { factura: Factura; onClose: () => void; onAnulada?: () => void }) {
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
      queryClient.invalidateQueries({ queryKey: ['factura-detalle', factura.id] });
      onAnulada?.();
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
export function ModalLinkPago({ factura, onClose }: { factura: Factura; onClose: () => void }) {
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
