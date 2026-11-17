import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { PaginaResultado } from '../types/pagina-resultado';

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

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Ver entregas" de WebhooksPanel.tsx. Sin endpoint individual de webhook: usa la lista completa para el título. */
export function WebhookEntregas() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pagina, setPagina] = useState(1);

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => (await apiClient.get<Webhook[]>('/webhooks')).data,
  });
  const webhook = webhooks?.find((w) => w.id === id);

  const { data: entregas } = useQuery({
    queryKey: ['webhook-entregas', id, pagina],
    queryFn: async () => (await apiClient.get<PaginaResultado<WebhookDelivery>>(`/webhooks/${id}/deliveries`, { params: { pagina } })).data,
  });

  return (
    <PaginaDocumento
      titulo={webhook ? `Entregas — ${webhook.url}` : 'Entregas del webhook'}
      rutaVolver="/webhooks"
      etiquetaVolver="Volver a Webhooks"
      haycambios={false}
      resumen={
        entregas ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entregas.total} entrega(s)</span>
          </div>
        ) : null
      }
      acciones={
        <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/webhooks')}>
          Volver
        </Button>
      }
    >
      <Card titulo="Historial de entregas">
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
      </Card>
    </PaginaDocumento>
  );
}
