import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Modal } from '../../molecules/Modal/Modal';
import { Button } from '../../atoms/Button/Button';
import { QUERY_KEY_PENDIENTES } from '../BandejaWhatsappDrawer/BandejaWhatsappDrawer';

interface FacturaDocumento {
  id: string;
  numero: string | null;
  ncf: string | null;
  fecha: string;
  total: number;
  pagada: boolean;
  saldoPendiente: number;
}

interface CotizacionDocumento {
  id: string;
  numero: string;
  total: string;
  estado: string;
  createdAt: string;
}

interface DocumentosCliente {
  facturasRecientes: FacturaDocumento[];
  facturasPendientes: FacturaDocumento[];
  cotizacionesRecientes: CotizacionDocumento[];
}

type TipoDocumentoWhatsapp = 'FACTURA' | 'COTIZACION' | 'ESTADO_CUENTA' | 'FACTURAS_RECIENTES' | 'FACTURAS_PENDIENTES' | 'COTIZACIONES_RECIENTES';

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

const ETIQUETA_EXITO: Record<TipoDocumentoWhatsapp, string> = {
  FACTURA: 'Factura enviada.',
  COTIZACION: 'Cotización enviada.',
  ESTADO_CUENTA: 'Estado de cuenta enviado.',
  FACTURAS_RECIENTES: 'Relación de facturas enviada.',
  FACTURAS_PENDIENTES: 'Facturas pendientes enviadas.',
  COTIZACIONES_RECIENTES: 'Cotizaciones enviadas.',
};

/**
 * "Enviar documento" desde la barra contextual CRM de la conversación —
 * el humano ve la lista real de facturas/cotizaciones del cliente ANTES
 * de mandar nada (nunca a ciegas). Factura/Cotización/Estado de cuenta se
 * mandan como PDF real adjunto (ver WhatsappBandejaService.enviarDocumento);
 * las "relaciones" (pendientes/recientes) van como texto con un link por
 * documento — no hay PDF dedicado para una lista ad-hoc.
 */
export function ModalEnviarDocumentoWhatsapp({
  telefono,
  clienteId,
  clienteNombre,
  onClose,
}: {
  telefono: string;
  clienteId: string;
  clienteNombre: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const { data: documentos, isLoading } = useQuery({
    queryKey: ['whatsapp-bandeja-documentos-cliente', clienteId],
    queryFn: async () => (await apiClient.get<DocumentosCliente>(`/admin/whatsapp-bandeja/clientes/${clienteId}/documentos`)).data,
  });

  const enviar = useMutation({
    mutationFn: async (body: { tipo: TipoDocumentoWhatsapp; documentoId?: string }) =>
      apiClient.post(`/admin/whatsapp-bandeja/${encodeURIComponent(telefono)}/enviar-documento`, { clienteId, ...body }),
    onSuccess: (_resultado, variables) => {
      setError(null);
      setExito(ETIQUETA_EXITO[variables.tipo]);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_PENDIENTES });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-bandeja-conversacion', telefono] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-mensajes-conversaciones'] });
    },
    onError: (err) => {
      setExito(null);
      setError(mensajeErrorApi(err, 'No se pudo enviar el documento.'));
    },
  });

  function enviarFila(accion: () => void) {
    setError(null);
    setExito(null);
    accion();
  }

  return (
    <Modal titulo={`Enviar documento — ${clienteNombre}`} onClose={onClose}>
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando documentos del cliente…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {exito && <p className="text-sm text-emerald-600">{exito}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variante="secundario"
            disabled={enviar.isPending}
            onClick={() => enviarFila(() => enviar.mutate({ tipo: 'ESTADO_CUENTA' }))}
          >
            Enviar estado de cuenta
          </Button>
          {!!documentos?.facturasPendientes.length && (
            <Button
              type="button"
              variante="secundario"
              disabled={enviar.isPending}
              onClick={() => enviarFila(() => enviar.mutate({ tipo: 'FACTURAS_PENDIENTES' }))}
            >
              Enviar lista de pendientes
            </Button>
          )}
          {!!documentos?.facturasRecientes.length && (
            <Button
              type="button"
              variante="secundario"
              disabled={enviar.isPending}
              onClick={() => enviarFila(() => enviar.mutate({ tipo: 'FACTURAS_RECIENTES' }))}
            >
              Enviar últimas facturas
            </Button>
          )}
          {!!documentos?.cotizacionesRecientes.length && (
            <Button
              type="button"
              variante="secundario"
              disabled={enviar.isPending}
              onClick={() => enviarFila(() => enviar.mutate({ tipo: 'COTIZACIONES_RECIENTES' }))}
            >
              Enviar cotizaciones
            </Button>
          )}
        </div>

        {!!documentos?.facturasPendientes.length && (
          <SeccionDocumentos
            titulo="Facturas pendientes de pago"
            filas={documentos.facturasPendientes.map((f) => ({
              id: f.id,
              etiqueta: `${f.numero ?? f.ncf ?? '(sin número)'} — ${new Date(f.fecha).toLocaleDateString('es-DO')}`,
              monto: `${formatoRD(f.total)} · pendiente ${formatoRD(f.saldoPendiente)}`,
            }))}
            deshabilitado={enviar.isPending}
            onEnviar={(id) => enviarFila(() => enviar.mutate({ tipo: 'FACTURA', documentoId: id }))}
          />
        )}

        {!!documentos?.facturasRecientes.length && (
          <SeccionDocumentos
            titulo="Últimas facturas"
            filas={documentos.facturasRecientes.map((f) => ({
              id: f.id,
              etiqueta: `${f.numero ?? f.ncf ?? '(sin número)'} — ${new Date(f.fecha).toLocaleDateString('es-DO')}`,
              monto: formatoRD(f.total),
            }))}
            deshabilitado={enviar.isPending}
            onEnviar={(id) => enviarFila(() => enviar.mutate({ tipo: 'FACTURA', documentoId: id }))}
          />
        )}

        {!!documentos?.cotizacionesRecientes.length && (
          <SeccionDocumentos
            titulo="Cotizaciones recientes"
            filas={documentos.cotizacionesRecientes.map((c) => ({
              id: c.id,
              etiqueta: `${c.numero} — ${new Date(c.createdAt).toLocaleDateString('es-DO')}`,
              monto: `${formatoRD(Number(c.total))} (${c.estado})`,
            }))}
            deshabilitado={enviar.isPending}
            onEnviar={(id) => enviarFila(() => enviar.mutate({ tipo: 'COTIZACION', documentoId: id }))}
          />
        )}

        {!isLoading &&
          !documentos?.facturasPendientes.length &&
          !documentos?.facturasRecientes.length &&
          !documentos?.cotizacionesRecientes.length && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Este cliente todavía no tiene facturas ni cotizaciones registradas.</p>
          )}
      </div>
    </Modal>
  );
}

function SeccionDocumentos({
  titulo,
  filas,
  deshabilitado,
  onEnviar,
}: {
  titulo: string;
  filas: { id: string; etiqueta: string; monto: string }[];
  deshabilitado: boolean;
  onEnviar: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h3>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {filas.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{f.etiqueta}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{f.monto}</p>
            </div>
            <button
              type="button"
              disabled={deshabilitado}
              onClick={() => onEnviar(f.id)}
              className="shrink-0 rounded-md bg-sol-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
