import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

const PLACEHOLDER_CONFIGURADO = '•••••••• (configurado)';

interface TravelConfig {
  duffelApiTokenConfigurado: boolean;
  duffelWebhookSecretConfigurado: boolean;
  hotelbedsApiKeyConfigurado: boolean;
  hotelbedsSecretConfigurado: boolean;
  hotelbedsMoneda: string;
  hotelbedsTasaCambio: number | null;
}

/**
 * Cuenta de Duffel/Hotelbeds PROPIA de este tenant — hasta que no se
 * cargue acá, las pestañas "Buscar vuelo"/"Buscar hotel" de
 * TravelReservas.tsx quedan bloqueadas (sin fallback a ninguna cuenta
 * compartida, decisión explícita del usuario). Mismo criterio de
 * secretos que WhatsappConfigPanel: nunca se muestran en claro, dejar el
 * campo vacío al guardar no borra el secreto ya guardado.
 */
export function TravelConfigPanel() {
  return (
    <div className="space-y-4">
      <SeccionDuffel />
      <SeccionHotelbeds />
      <SeccionReconciliacion />
    </div>
  );
}

function SeccionDuffel() {
  const queryClient = useQueryClient();
  const [duffelApiToken, setDuffelApiToken] = useState('');
  const [duffelWebhookSecret, setDuffelWebhookSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ['travel-config'],
    queryFn: async () => (await apiClient.get<TravelConfig>('/admin/travel-config')).data,
  });

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch('/admin/travel-config', {
        ...(duffelApiToken !== '' ? { duffelApiToken } : {}),
        ...(duffelWebhookSecret !== '' ? { duffelWebhookSecret } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setDuffelApiToken('');
      setDuffelWebhookSecret('');
      queryClient.invalidateQueries({ queryKey: ['travel-config'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la cuenta de Duffel.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  if (!config) return null;

  return (
    <Card titulo="Duffel (vuelos)" descripcion="Tu propia cuenta de Duffel — sin esto, buscar y reservar vuelos queda bloqueado.">
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <FormField
          id="duffelApiToken"
          label="Duffel API Token"
          type="password"
          value={duffelApiToken}
          onChange={(e) => setDuffelApiToken(e.target.value)}
          placeholder={config.duffelApiTokenConfigurado ? PLACEHOLDER_CONFIGURADO : 'duffel_test_...'}
        />
        <p className="text-xs text-slate-400">
          "duffel_test_..." para probar en sandbox, "duffel_live_..." en producción — es el mismo endpoint de Duffel, solo cambia el
          prefijo del token.
        </p>

        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Webhook de Duffel</p>
          <p className="text-xs text-slate-400">
            Registrá esta URL en TU panel de Duffel (Webhooks) para recibir avisos de cambios de itinerario o cancelaciones hechas
            fuera de esta plataforma:
          </p>
          <code className="block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {window.location.origin}/api/webhooks/duffel
          </code>
          <FormField
            id="duffelWebhookSecret"
            label="Webhook Secret"
            type="password"
            value={duffelWebhookSecret}
            onChange={(e) => setDuffelWebhookSecret(e.target.value)}
            placeholder={config.duffelWebhookSecretConfigurado ? PLACEHOLDER_CONFIGURADO : 'whsec_...'}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

function SeccionHotelbeds() {
  const queryClient = useQueryClient();
  const [hotelbedsApiKey, setHotelbedsApiKey] = useState('');
  const [hotelbedsSecret, setHotelbedsSecret] = useState('');
  const [moneda, setMoneda] = useState<string | null>(null);
  const [tasaCambio, setTasaCambio] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ['travel-config'],
    queryFn: async () => (await apiClient.get<TravelConfig>('/admin/travel-config')).data,
  });

  const monedaActual = moneda ?? config?.hotelbedsMoneda ?? 'EUR';

  useEffect(() => {
    if (config?.hotelbedsTasaCambio !== null && config?.hotelbedsTasaCambio !== undefined) setTasaCambio(String(config.hotelbedsTasaCambio));
  }, [config?.hotelbedsTasaCambio]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch('/admin/travel-config', {
        ...(hotelbedsApiKey !== '' ? { hotelbedsApiKey } : {}),
        ...(hotelbedsSecret !== '' ? { hotelbedsSecret } : {}),
        hotelbedsMoneda: monedaActual,
        ...(monedaActual !== 'EUR' && tasaCambio !== '' ? { hotelbedsTasaCambio: Number(tasaCambio) } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setHotelbedsApiKey('');
      setHotelbedsSecret('');
      queryClient.invalidateQueries({ queryKey: ['travel-config'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la cuenta de Hotelbeds.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  if (!config) return null;

  return (
    <Card
      titulo="Hotelbeds (hoteles)"
      descripcion="Tu propia cuenta de Hotelbeds — sin esto, buscar y reservar hoteles queda bloqueado."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <FormField
          id="hotelbedsApiKey"
          label="Api Key"
          type="password"
          value={hotelbedsApiKey}
          onChange={(e) => setHotelbedsApiKey(e.target.value)}
          placeholder={config.hotelbedsApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'Api key de developer.hotelbeds.com'}
        />
        <FormField
          id="hotelbedsSecret"
          label="Secret"
          type="password"
          value={hotelbedsSecret}
          onChange={(e) => setHotelbedsSecret(e.target.value)}
          placeholder={config.hotelbedsSecretConfigurado ? PLACEHOLDER_CONFIGURADO : 'Secret compartido'}
        />
        <p className="text-xs text-slate-400">Las dos firman cada request (X-Signature) — sandbox de test, mismo host que producción.</p>

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Moneda de venta</label>
              <Select value={monedaActual} onChange={(e) => setMoneda(e.target.value)}>
                <option value="EUR">EUR (sin conversión — la nativa de Hotelbeds)</option>
                <option value="USD">USD</option>
                <option value="DOP">DOP</option>
              </Select>
            </div>
            {monedaActual !== 'EUR' && (
              <FormField
                label={`Tasa: 1 EUR = ? ${monedaActual}`}
                type="number"
                min="0.000001"
                step="0.000001"
                value={tasaCambio}
                onChange={(e) => setTasaCambio(e.target.value)}
                placeholder="ej. 1.08"
                required
              />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Hotelbeds cotiza siempre en EUR — si vendés en otra moneda, la tasa es manual (actualizala vos, no se consulta ningún tipo de cambio en vivo).
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={guardar.isPending || (monedaActual !== 'EUR' && !tasaCambio)}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

interface ResumenReconciliacionTravel {
  totalOrdenesRevisadas: number;
  ordenesHuerfanas: { id: string; localizador: string; montoTotal: string; moneda: string; creadaEn: string; canceladaEn: string | null }[];
  cancelacionesNoReflejadas: { ordenId: string; reservaId: string; codigoInterno: string; canceladaEn: string }[];
}

/**
 * Duffel no expone el saldo real del Balance por API (confirmado contra
 * el sandbox real: /air/balances, /balances y /air/balance dan 404) —
 * esto NO compara números, cruza las órdenes reales de TU cuenta contra
 * tus TravelReserva internas para detectar huérfanas o cancelaciones que
 * el webhook no capturó. Nunca corrige nada solo, es un reporte.
 */
function SeccionReconciliacion() {
  const [resultado, setResultado] = useState<ResumenReconciliacionTravel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revisar = useMutation({
    mutationFn: async () => (await apiClient.get<ResumenReconciliacionTravel>('/admin/travel/reconciliacion')).data,
    onSuccess: (data) => {
      setResultado(data);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo revisar tu cuenta de Duffel — intentá de nuevo en unos minutos.')),
  });

  return (
    <Card
      titulo="Reconciliación de tu cuenta Duffel"
      descripcion="Cruza las órdenes reales de tu cuenta contra tus reservas internas — no corrige nada solo, solo reporta."
    >
      <Button onClick={() => revisar.mutate()} disabled={revisar.isPending}>
        {revisar.isPending ? 'Revisando…' : 'Revisar ahora'}
      </Button>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {resultado && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-400">{resultado.totalOrdenesRevisadas} orden(es) revisada(s) en Duffel.</p>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Órdenes huérfanas (existen en Duffel, sin reserva interna) — {resultado.ordenesHuerfanas.length}
            </p>
            {resultado.ordenesHuerfanas.length === 0 ? (
              <p className="text-xs text-slate-400">Ninguna.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {resultado.ordenesHuerfanas.map((o) => (
                  <li key={o.id} className="rounded bg-amber-50 px-2 py-1 dark:bg-amber-500/10">
                    {o.localizador} — {o.moneda} {o.montoTotal} — {new Date(o.creadaEn).toLocaleDateString('es-DO')}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Cancelaciones no reflejadas internamente — {resultado.cancelacionesNoReflejadas.length}
            </p>
            {resultado.cancelacionesNoReflejadas.length === 0 ? (
              <p className="text-xs text-slate-400">Ninguna.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {resultado.cancelacionesNoReflejadas.map((c) => (
                  <li key={c.ordenId} className="rounded bg-red-50 px-2 py-1 dark:bg-red-500/10">
                    {c.codigoInterno} — cancelada en Duffel el {new Date(c.canceladaEn).toLocaleDateString('es-DO')}, sigue sin marcar CANCELADA internamente
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
