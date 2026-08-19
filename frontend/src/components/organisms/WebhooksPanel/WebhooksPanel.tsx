import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Webhook {
  id: string;
  url: string;
  eventos: string[];
  activo: boolean;
}

interface WebhookDelivery {
  id: string;
  evento: string;
  statusCode: number | null;
  exitoso: boolean;
  intentos: number;
  createdAt: string;
}

const EVENTOS_DISPONIBLES = [
  { clave: 'factura.creada', etiqueta: 'Factura creada' },
  { clave: 'factura.anulada', etiqueta: 'Factura anulada' },
  { clave: 'inventario.stock_bajo', etiqueta: 'Stock bajo' },
  { clave: 'compras.orden_recibida', etiqueta: 'Orden de compra recibida' },
  { clave: 'compras.orden_devuelta', etiqueta: 'Devolución a proveedor' },
  { clave: 'clientes.cliente_creado', etiqueta: 'Cliente creado' },
  { clave: 'nomina.periodo_pagado', etiqueta: 'Período de nómina pagado' },
  { clave: 'pagos.factura_registrado', etiqueta: 'Cobro registrado' },
  { clave: 'pagos.orden_compra_registrado', etiqueta: 'Pago a proveedor registrado' },
  { clave: 'cotizaciones.enviada', etiqueta: 'Cotización enviada' },
];

export function WebhooksPanel() {
  const queryClient = useQueryClient();
  const [modalNuevo, setModalNuevo] = useState(false);
  const [webhookVerEntregas, setWebhookVerEntregas] = useState<Webhook | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => (await apiClient.get<Webhook[]>('/webhooks')).data,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: () => setError('No se pudo eliminar el webhook.'),
  });

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {webhooks?.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay webhooks configurados"
          descripcion="Creá uno para que un sistema externo se entere en tiempo real de tus facturas, cobros, etc."
          etiquetaAccion="Nuevo webhook"
          onAccion={() => setModalNuevo(true)}
        />
      ) : (
        <Card
          sinPadding
          titulo="Webhooks"
          descripcion="Notifican a una URL externa cuando ocurre un evento del negocio, con firma HMAC para verificar el origen."
          acciones={<Button onClick={() => setModalNuevo(true)}>Nuevo webhook</Button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">URL</th>
                  <th className="px-5 py-3 font-medium">Eventos</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {webhooks?.map((webhook) => (
                  <tr key={webhook.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono text-xs">{webhook.url}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {webhook.eventos.map((evento) => (
                          <Badge key={evento}>{evento}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tono={webhook.activo ? 'exito' : 'neutro'}>{webhook.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Ver entregas', onClick: () => setWebhookVerEntregas(webhook) },
                          { etiqueta: 'Eliminar', onClick: () => eliminar.mutate(webhook.id), tono: 'peligro' as const },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modalNuevo && <ModalNuevoWebhook onClose={() => setModalNuevo(false)} />}
      {webhookVerEntregas && <ModalEntregas webhook={webhookVerEntregas} onClose={() => setWebhookVerEntregas(null)} />}
    </div>
  );
}

function ModalNuevoWebhook({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [eventosSeleccionados, setEventosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [secretCreado, setSecretCreado] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<{ secret: string }>('/webhooks', { url, eventos: Array.from(eventosSeleccionados) })).data,
    onSuccess: (webhook) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setSecretCreado(webhook.secret);
    },
    onError: () => setError('No se pudo crear el webhook. Revisa que la URL sea válida (http/https, sin apuntar a una IP privada).'),
  });

  function alternarEvento(clave: string) {
    setEventosSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (eventosSeleccionados.size === 0) {
      setError('Seleccioná al menos un evento.');
      return;
    }
    crear.mutate();
  }

  if (secretCreado) {
    return (
      <Modal titulo="Webhook creado" onClose={onClose}>
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Guardá este secreto ahora — no se va a volver a mostrar. Se usa para verificar la firma <code>X-Sol-Signature</code> en cada entrega.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">{secretCreado}</code>
            <Button type="button" variante="secundario" onClick={() => navigator.clipboard.writeText(secretCreado)}>
              Copiar
            </Button>
          </div>
          <Button onClick={onClose} className="w-full">
            Listo
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo="Nuevo webhook" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="webhook-url" label="URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required />
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Eventos</p>
          <div className="flex flex-col gap-1">
            {EVENTOS_DISPONIBLES.map((evento) => (
              <label key={evento.clave} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={eventosSeleccionados.has(evento.clave)} onChange={() => alternarEvento(evento.clave)} />
                {evento.etiqueta}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear webhook'}
        </Button>
      </form>
    </Modal>
  );
}

function ModalEntregas({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const [pagina, setPagina] = useState(1);
  const { data: entregas } = useQuery({
    queryKey: ['webhook-entregas', webhook.id, pagina],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<WebhookDelivery>>(`/webhooks/${webhook.id}/deliveries`, { params: { pagina } })).data,
  });

  return (
    <Modal titulo={`Entregas — ${webhook.url}`} onClose={onClose}>
      <div className="space-y-2">
        {entregas?.datos.length === 0 && <p className="text-sm text-slate-400">Todavía no se disparó ninguna entrega para este webhook.</p>}
        {entregas?.datos.map((entrega) => (
          <div key={entrega.id} className="flex items-center justify-between rounded-md border border-slate-200 p-2 text-sm dark:border-slate-800">
            <div>
              <p className="text-slate-900 dark:text-slate-100">{entrega.evento}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(entrega.createdAt).toLocaleString('es-DO')} · {entrega.intentos} intento(s)
                {entrega.statusCode !== null && ` · HTTP ${entrega.statusCode}`}
              </p>
            </div>
            <Badge tono={entrega.exitoso ? 'exito' : 'peligro'}>{entrega.exitoso ? 'Exitosa' : 'Fallida'}</Badge>
          </div>
        ))}
        {entregas && (
          <Paginacion pagina={entregas.pagina} tamanoPagina={entregas.tamanoPagina} total={entregas.total} onCambiarPagina={setPagina} />
        )}
      </div>
    </Modal>
  );
}
