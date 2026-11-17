import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

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

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Nuevo webhook" de WebhooksPanel.tsx. Tras crear, muestra el secreto una sola vez antes de volver. */
export function WebhookNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [eventosSeleccionados, setEventosSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [secretCreado, setSecretCreado] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<{ secret: string }>('/webhooks', { url, eventos: Array.from(eventosSeleccionados) })).data,
    onSuccess: (webhook) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      confirmarGuardado();
      setSecretCreado(webhook.secret);
    },
    onError: (err) =>
      setError(mensajeErrorApi(err, 'No se pudo crear el webhook. Revisa que la URL sea válida (http/https, sin apuntar a una IP privada).')),
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

  const [haycambios, confirmarGuardado] = useHayCambios({ url, eventosSeleccionados: Array.from(eventosSeleccionados) });

  if (secretCreado) {
    return (
      <PaginaDocumento
        titulo="Webhook creado"
        rutaVolver="/webhooks"
        etiquetaVolver="Volver a Webhooks"
        haycambios={false}
        resumen={
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">URL</span>
            <span className="break-all text-sm font-semibold text-slate-900 dark:text-slate-100">{url}</span>
          </div>
        }
        acciones={
          <Button className="w-full" onClick={() => navigate('/webhooks')}>
            Listo
          </Button>
        }
      >
        <Card titulo="Secreto del webhook">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Guardá este secreto ahora — no se va a volver a mostrar. Se usa para verificar la firma{' '}
            <code>X-Sol-Signature</code> en cada entrega.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">{secretCreado}</code>
            <Button type="button" variante="secundario" onClick={() => navigator.clipboard.writeText(secretCreado)}>
              Copiar
            </Button>
          </div>
        </Card>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo="Nuevo webhook"
      rutaVolver="/webhooks"
      etiquetaVolver="Volver a Webhooks"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Eventos seleccionados</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{eventosSeleccionados.size}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-webhook" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear webhook'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/webhooks')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-webhook" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información del webhook" descripcion="Notifica a una URL externa cuando ocurre un evento del negocio, con firma HMAC para verificar el origen.">
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
        </Card>
      </form>
    </PaginaDocumento>
  );
}
