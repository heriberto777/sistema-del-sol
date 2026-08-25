import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';

interface WhatsappConfig {
  habilitado: boolean;
  twilioAccountSid: string | null;
  twilioAuthTokenConfigurado: boolean;
  twilioWhatsappFrom: string | null;
  iaProveedor: string | null;
  iaModelo: string | null;
  iaApiKeyConfigurado: boolean;
  historialMensajes: number;
}

/**
 * Solo guarda credenciales/preferencias (plan de integración Cuadre, ítem
 * H-2a) — a propósito no envía ningún mensaje de prueba ni conecta con el
 * bot conversacional todavía (H-2b, diferido). Mismo criterio de secretos
 * que WebhooksPanel/PlataformaConfig: nunca se muestran en claro, solo
 * "configurado: true/false"; dejar el campo vacío al guardar no borra el
 * secreto ya guardado (hay que escribir explícitamente para reemplazarlo).
 */
export function WhatsappConfigPanel() {
  const queryClient = useQueryClient();
  const [habilitado, setHabilitado] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioWhatsappFrom, setTwilioWhatsappFrom] = useState('');
  const [iaProveedor, setIaProveedor] = useState('');
  const [iaModelo, setIaModelo] = useState('');
  const [iaApiKey, setIaApiKey] = useState('');
  const [historialMensajes, setHistorialMensajes] = useState('10');
  const [error, setError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => (await apiClient.get<WhatsappConfig>('/admin/whatsapp-config')).data,
  });

  useEffect(() => {
    if (!config) return;
    setHabilitado(config.habilitado);
    setTwilioAccountSid(config.twilioAccountSid ?? '');
    setTwilioWhatsappFrom(config.twilioWhatsappFrom ?? '');
    setIaProveedor(config.iaProveedor ?? '');
    setIaModelo(config.iaModelo ?? '');
    setHistorialMensajes(String(config.historialMensajes));
  }, [config]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch('/admin/whatsapp-config', {
        habilitado,
        twilioAccountSid,
        twilioWhatsappFrom,
        iaProveedor: iaProveedor || undefined,
        iaModelo,
        historialMensajes: Number(historialMensajes),
        ...(twilioAuthToken !== '' ? { twilioAuthToken } : {}),
        ...(iaApiKey !== '' ? { iaApiKey } : {}),
      }),
    onSuccess: () => {
      setTwilioAuthToken('');
      setIaApiKey('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
    },
    onError: () => setError('No se pudo guardar la configuración.'),
  });

  return (
    <Card
      titulo="WhatsApp"
      descripcion="Credenciales de Twilio y del proveedor de IA para el futuro bot conversacional — este formulario solo las guarda, todavía no envía ni responde mensajes."
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={habilitado} onChange={(e) => setHabilitado(e.target.checked)} />
          Habilitar WhatsApp para este negocio
        </label>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Twilio</p>
          <FormField
            id="whatsapp-twilio-sid"
            label="Account SID"
            value={twilioAccountSid}
            onChange={(e) => setTwilioAccountSid(e.target.value)}
          />
          <FormField
            id="whatsapp-twilio-token"
            label={config?.twilioAuthTokenConfigurado ? 'Auth Token (ya configurado — dejar vacío para no cambiarlo)' : 'Auth Token'}
            type="password"
            value={twilioAuthToken}
            onChange={(e) => setTwilioAuthToken(e.target.value)}
            placeholder={config?.twilioAuthTokenConfigurado ? '••••••••' : undefined}
          />
          <FormField
            id="whatsapp-twilio-from"
            label="Número de WhatsApp (con código de país, ej. +18095551234)"
            value={twilioWhatsappFrom}
            onChange={(e) => setTwilioWhatsappFrom(e.target.value)}
          />
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Proveedor de IA</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Proveedor</label>
            <select
              value={iaProveedor}
              onChange={(e) => setIaProveedor(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Sin proveedor</option>
              <option value="ANTHROPIC">Anthropic</option>
              <option value="OPENAI">OpenAI</option>
              <option value="VERCEL">Vercel</option>
            </select>
          </div>
          <FormField
            id="whatsapp-ia-modelo"
            label="Modelo"
            value={iaModelo}
            onChange={(e) => setIaModelo(e.target.value)}
            disabled={!iaProveedor}
          />
          <FormField
            id="whatsapp-ia-apikey"
            label={config?.iaApiKeyConfigurado ? 'API Key (ya configurada — dejar vacío para no cambiarla)' : 'API Key'}
            type="password"
            value={iaApiKey}
            onChange={(e) => setIaApiKey(e.target.value)}
            placeholder={config?.iaApiKeyConfigurado ? '••••••••' : undefined}
            disabled={!iaProveedor}
          />
          <FormField
            id="whatsapp-historial"
            label="Mensajes de historial que se le pasan a la IA por conversación"
            type="number"
            min={0}
            value={historialMensajes}
            onChange={(e) => setHistorialMensajes(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}
