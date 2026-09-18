import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Switch } from '../components/atoms/Switch/Switch';
import { NcfPlataformaPanel } from '../components/organisms/NcfPlataformaPanel/NcfPlataformaPanel';
import { CampoImagen } from '../components/molecules/CampoImagen/CampoImagen';
import { Badge } from '../components/atoms/Badge/Badge';
import { SelectorModeloIa, ModeloIa } from '../components/molecules/SelectorModeloIa/SelectorModeloIa';
import { PLANTILLAS_DOCUMENTO, PlantillaDocumento } from '../constants/plantilla-documento';

/** "Cargar modelos" de IA para productos siempre usa la API key ya guardada de PLATAFORMA — ver SelectorModeloIa. */
async function cargarModelosPlataforma(proveedor: string): Promise<ModeloIa[]> {
  return (await platformApiClient.get<{ modelos: ModeloIa[] }>('/platform/configuracion/ia-imagen/modelos', { params: { proveedor } })).data.modelos;
}

/** Publicaciones Sociales (Fase 2) — modelos de GENERACIÓN de imagen, familia distinta a los de arriba (vision/chat). */
async function cargarModelosFondo(proveedor: string): Promise<ModeloIa[]> {
  return (await platformApiClient.get<{ modelos: ModeloIa[] }>('/platform/configuracion/ia-fondo/modelos', { params: { proveedor } })).data.modelos;
}

export interface ConfiguracionPlataforma {
  general: {
    nombreNegocio: string | null;
    logo: string | null;
    rnc: string | null;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
    modalidadFacturacion: 'NCF' | 'ECF';
    porcentajeItbis: number;
    plantillaDocumento: PlantillaDocumento;
  };
  notificaciones: {
    email: {
      habilitado: boolean | null;
      host: string | null;
      port: number | null;
      user: string | null;
      passwordConfigurado: boolean;
      from: string | null;
    };
    whatsapp: {
      accountSid: string | null;
      authTokenConfigurado: boolean;
      from: string | null;
    };
  };
  pasarela: {
    activa: string | null;
    currency: string | null;
    stripeSecretKeyConfigurado: boolean;
    stripeWebhookSecretConfigurado: boolean;
  };
  webhook: {
    url: string | null;
    activo: boolean;
    secretConfigurado: boolean;
  };
  autoSuspension: {
    diasParaAutoSuspender: number;
  };
  dominioPropio: {
    npmBaseUrl: string | null;
    npmUsuario: string | null;
    npmPasswordConfigurado: boolean;
    npmForwardHost: string | null;
    npmForwardPort: number | null;
    npmPublicHost: string | null;
  };
  iaImagen: {
    proveedorActivo: string | null;
    claudeApiKeyConfigurado: boolean;
    openaiApiKeyConfigurado: boolean;
    geminiApiKeyConfigurado: boolean;
    claudeModelo: string | null;
    openaiModelo: string | null;
    geminiModelo: string | null;
    limiteMensual: number;
  };
  iaFondo: {
    proveedorActivo: string | null;
    openaiModelo: string | null;
    geminiModelo: string | null;
    limiteMensual: number;
  };
  iaAsistente: {
    limiteMensual: number;
  };
  travel: {
    duffelApiTokenConfigurado: boolean;
    duffelWebhookSecretConfigurado: boolean;
    hotelbedsApiKeyConfigurado: boolean;
    hotelbedsSecretConfigurado: boolean;
    hotelbedsMoneda: string;
    hotelbedsTasaCambio: number | null;
  };
}

// Fase 4 — reglas de notificación de vencimiento configurables.
interface ReglaNotificacion {
  id: string;
  offsetDias: number;
  canal: 'EMAIL' | 'WEBHOOK' | 'WHATSAPP';
  activa: boolean;
}

const PLACEHOLDER_CONFIGURADO = '•••••••• (configurado)';

const TABS = [
  'General',
  'NCF / e-CF',
  'Notificaciones',
  'Pasarela de pago',
  'IA para productos',
  'Webhook',
  'Vencimientos',
  'Dominio propio',
  'Travel',
] as const;
type Tab = (typeof TABS)[number];

export function PlatformConfiguracion() {
  const [tab, setTab] = useState<Tab>('General');
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['platform-configuracion'],
    queryFn: async () => (await platformApiClient.get<ConfiguracionPlataforma>('/platform/configuracion')).data,
  });

  const guardar = useMutation({
    mutationFn: async (data: Record<string, unknown>) => platformApiClient.patch('/platform/configuracion', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-configuracion'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Configuración</h1>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              'shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'border-sol-500 text-sol-600 dark:text-sol-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {!config ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <>
          {tab === 'General' && <SeccionGeneral config={config} guardar={guardar} />}
          {tab === 'NCF / e-CF' && <NcfPlataformaPanel config={config} guardar={guardar} />}
          {tab === 'Notificaciones' && <SeccionNotificaciones config={config} guardar={guardar} />}
          {tab === 'Pasarela de pago' && <SeccionPasarela config={config} guardar={guardar} />}
          {tab === 'IA para productos' && (
            <div className="space-y-6">
              <SeccionIaImagen config={config} guardar={guardar} />
              <SeccionIaFondo config={config} guardar={guardar} />
            </div>
          )}
          {tab === 'Webhook' && <SeccionWebhook config={config} guardar={guardar} />}
          {tab === 'Vencimientos' && <SeccionVencimientos config={config} guardar={guardar} />}
          {tab === 'Dominio propio' && <SeccionDominioPropio config={config} guardar={guardar} />}
          {tab === 'Travel' && (
            <div className="space-y-4">
              <SeccionTravel config={config} guardar={guardar} />
              <SeccionTravelHotelbeds config={config} guardar={guardar} />
              <SeccionTravelReconciliacion />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export interface SeccionProps {
  config: ConfiguracionPlataforma;
  guardar: ReturnType<typeof useMutation<unknown, unknown, Record<string, unknown>>>;
}

function SeccionGeneral({ config, guardar }: SeccionProps) {
  const [nombreNegocio, setNombreNegocio] = useState(config.general.nombreNegocio ?? '');
  const [logo, setLogo] = useState(config.general.logo);
  const [rnc, setRnc] = useState(config.general.rnc ?? '');
  const [direccion, setDireccion] = useState(config.general.direccion ?? '');
  const [telefono, setTelefono] = useState(config.general.telefono ?? '');
  const [email, setEmail] = useState(config.general.email ?? '');
  const [plantillaDocumento, setPlantillaDocumento] = useState(config.general.plantillaDocumento);

  useEffect(() => {
    setNombreNegocio(config.general.nombreNegocio ?? '');
    setLogo(config.general.logo);
    setRnc(config.general.rnc ?? '');
    setDireccion(config.general.direccion ?? '');
    setTelefono(config.general.telefono ?? '');
    setEmail(config.general.email ?? '');
    setPlantillaDocumento(config.general.plantillaDocumento);
  }, [
    config.general.nombreNegocio,
    config.general.logo,
    config.general.rnc,
    config.general.direccion,
    config.general.telefono,
    config.general.email,
    config.general.plantillaDocumento,
  ]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({ nombreNegocio, logo, rnc, direccion, telefono, email, plantillaDocumento });
  }

  return (
    <Card
      titulo="Datos de mi empresa"
      descripcion="Empresa que opera la plataforma — aparece como emisora en las facturas que se le cobran a cada tenant y en correos/comunicaciones. El logo se muestra en el Login, antes de que se resuelva el tenant."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <CampoImagen valor={logo} onChange={setLogo} label="Logo de la plataforma" />
        <FormField
          id="nombreNegocio"
          label="Nombre de la empresa"
          value={nombreNegocio}
          onChange={(e) => setNombreNegocio(e.target.value)}
          placeholder="El Sistema del Sol"
        />
        <FormField id="rnc" label="RNC" value={rnc} onChange={(e) => setRnc(e.target.value)} />
        <FormField id="direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        <FormField id="telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <FormField id="email" label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label htmlFor="plantillaDocumento" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Diseño de la factura
          </label>
          <Select id="plantillaDocumento" value={plantillaDocumento} onChange={(e) => setPlantillaDocumento(e.target.value as PlantillaDocumento)}>
            {PLANTILLAS_DOCUMENTO.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

function SeccionNotificaciones({ config, guardar }: SeccionProps) {
  const email = config.notificaciones.email;
  const whatsapp = config.notificaciones.whatsapp;

  const [emailHabilitado, setEmailHabilitado] = useState(email.habilitado ?? false);
  const [smtpHost, setSmtpHost] = useState(email.host ?? '');
  const [smtpPort, setSmtpPort] = useState(email.port?.toString() ?? '');
  const [smtpUser, setSmtpUser] = useState(email.user ?? '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState(email.from ?? '');

  const [twilioAccountSid, setTwilioAccountSid] = useState(whatsapp.accountSid ?? '');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioWhatsappFrom, setTwilioWhatsappFrom] = useState(whatsapp.from ?? '');

  useEffect(() => {
    setEmailHabilitado(email.habilitado ?? false);
    setSmtpHost(email.host ?? '');
    setSmtpPort(email.port?.toString() ?? '');
    setSmtpUser(email.user ?? '');
    setSmtpFrom(email.from ?? '');
    setTwilioAccountSid(whatsapp.accountSid ?? '');
    setTwilioWhatsappFrom(whatsapp.from ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.habilitado, email.host, email.port, email.user, email.from, whatsapp.accountSid, whatsapp.from]);

  function guardarEmail(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      emailHabilitado,
      smtpHost,
      smtpPort: smtpPort ? Number(smtpPort) : undefined,
      smtpUser,
      smtpFrom,
      ...(smtpPassword !== '' ? { smtpPassword } : {}),
    });
    setSmtpPassword('');
  }

  function guardarWhatsapp(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      twilioAccountSid,
      twilioWhatsappFrom,
      ...(twilioAuthToken !== '' ? { twilioAuthToken } : {}),
    });
    setTwilioAuthToken('');
  }

  return (
    <div className="space-y-6">
      <Card titulo="Email (SMTP)" descripcion="Usado para recuperación de contraseña y avisos de facturación.">
        <form onSubmit={guardarEmail} className="max-w-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Habilitado</span>
            <Switch activo={emailHabilitado} onChange={setEmailHabilitado} />
          </div>
          <FormField id="smtpHost" label="Host SMTP" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
          <FormField id="smtpPort" label="Puerto" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
          <FormField id="smtpUser" label="Usuario" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
          <FormField
            id="smtpPassword"
            label="Contraseña"
            type="password"
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
            placeholder={email.passwordConfigurado ? PLACEHOLDER_CONFIGURADO : ''}
          />
          <FormField id="smtpFrom" label="Remitente (From)" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Card>

      <Card titulo="WhatsApp (Twilio)" descripcion="Usado para avisos por WhatsApp a clientes/administradores.">
        <form onSubmit={guardarWhatsapp} className="max-w-md space-y-3">
          <FormField
            id="twilioAccountSid"
            label="Account SID"
            value={twilioAccountSid}
            onChange={(e) => setTwilioAccountSid(e.target.value)}
          />
          <FormField
            id="twilioAuthToken"
            label="Auth Token"
            type="password"
            value={twilioAuthToken}
            onChange={(e) => setTwilioAuthToken(e.target.value)}
            placeholder={whatsapp.authTokenConfigurado ? PLACEHOLDER_CONFIGURADO : ''}
          />
          <FormField
            id="twilioWhatsappFrom"
            label="Número de WhatsApp (From)"
            value={twilioWhatsappFrom}
            onChange={(e) => setTwilioWhatsappFrom(e.target.value)}
            placeholder="whatsapp:+1415..."
          />
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SeccionPasarela({ config, guardar }: SeccionProps) {
  const pasarela = config.pasarela;
  const [pasarelaActiva, setPasarelaActiva] = useState(pasarela.activa ?? '');
  const [stripeCurrency, setStripeCurrency] = useState(pasarela.currency ?? '');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');

  useEffect(() => {
    setPasarelaActiva(pasarela.activa ?? '');
    setStripeCurrency(pasarela.currency ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasarela.activa, pasarela.currency]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      pasarelaActiva: pasarelaActiva || undefined,
      stripeCurrency,
      ...(stripeSecretKey !== '' ? { stripeSecretKey } : {}),
      ...(stripeWebhookSecret !== '' ? { stripeWebhookSecret } : {}),
    });
    setStripeSecretKey('');
    setStripeWebhookSecret('');
  }

  return (
    <Card titulo="Pasarela de pago" descripcion="Credenciales de la pasarela usada en el checkout público de facturas.">
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <div>
          <label htmlFor="pasarelaActiva" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Pasarela activa
          </label>
          <Select id="pasarelaActiva" value={pasarelaActiva} onChange={(e) => setPasarelaActiva(e.target.value)}>
            <option value="">Ninguna</option>
            <option value="stripe">Stripe</option>
            <option value="azul">Azul</option>
            <option value="cardnet">CardNet</option>
          </Select>
        </div>
        <FormField
          id="stripeCurrency"
          label="Moneda (Stripe)"
          value={stripeCurrency}
          onChange={(e) => setStripeCurrency(e.target.value)}
          placeholder="usd"
        />
        <FormField
          id="stripeSecretKey"
          label="Stripe Secret Key"
          type="password"
          value={stripeSecretKey}
          onChange={(e) => setStripeSecretKey(e.target.value)}
          placeholder={pasarela.stripeSecretKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'sk_live_...'}
        />
        <FormField
          id="stripeWebhookSecret"
          label="Stripe Webhook Secret"
          type="password"
          value={stripeWebhookSecret}
          onChange={(e) => setStripeWebhookSecret(e.target.value)}
          placeholder={pasarela.stripeWebhookSecretConfigurado ? PLACEHOLDER_CONFIGURADO : 'whsec_...'}
        />
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

function SeccionTravel({ config, guardar }: SeccionProps) {
  const travel = config.travel;
  const [duffelApiToken, setDuffelApiToken] = useState('');
  const [duffelWebhookSecret, setDuffelWebhookSecret] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      ...(duffelApiToken !== '' ? { duffelApiToken } : {}),
      ...(duffelWebhookSecret !== '' ? { duffelWebhookSecret } : {}),
    });
    setDuffelApiToken('');
    setDuffelWebhookSecret('');
  }

  return (
    <Card
      titulo="Travel Management (Duffel)"
      descripcion="Cuenta única y compartida de la plataforma para reservar vuelos — cada agencia (tenant) no trae la suya propia."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <FormField
          id="duffelApiToken"
          label="Duffel API Token"
          type="password"
          value={duffelApiToken}
          onChange={(e) => setDuffelApiToken(e.target.value)}
          placeholder={travel.duffelApiTokenConfigurado ? PLACEHOLDER_CONFIGURADO : 'duffel_test_...'}
        />
        <p className="text-xs text-slate-400">
          "duffel_test_..." para probar en sandbox, "duffel_live_..." en producción — es el mismo endpoint de Duffel, solo cambia el
          prefijo del token.
        </p>

        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Webhook de Duffel</p>
          <p className="text-xs text-slate-400">
            Registrá esta URL en el panel de Duffel (Webhooks) para recibir avisos de cambios de itinerario o cancelaciones hechas
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
            placeholder={travel.duffelWebhookSecretConfigurado ? PLACEHOLDER_CONFIGURADO : 'whsec_...'}
          />
        </div>

        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

function SeccionTravelHotelbeds({ config, guardar }: SeccionProps) {
  const travel = config.travel;
  const [hotelbedsApiKey, setHotelbedsApiKey] = useState('');
  const [hotelbedsSecret, setHotelbedsSecret] = useState('');
  const [moneda, setMoneda] = useState(travel.hotelbedsMoneda);
  const [tasaCambio, setTasaCambio] = useState(travel.hotelbedsTasaCambio !== null ? String(travel.hotelbedsTasaCambio) : '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      ...(hotelbedsApiKey !== '' ? { hotelbedsApiKey } : {}),
      ...(hotelbedsSecret !== '' ? { hotelbedsSecret } : {}),
      hotelbedsMoneda: moneda,
      ...(moneda !== 'EUR' && tasaCambio !== '' ? { hotelbedsTasaCambio: Number(tasaCambio) } : {}),
    });
    setHotelbedsApiKey('');
    setHotelbedsSecret('');
  }

  return (
    <Card
      titulo="Travel Management (Hotelbeds)"
      descripcion="Cuenta única y compartida de la plataforma para reservar hoteles — factura neto con liquidación periódica, nunca pide tarjeta al reservar."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <FormField
          id="hotelbedsApiKey"
          label="Api Key"
          type="password"
          value={hotelbedsApiKey}
          onChange={(e) => setHotelbedsApiKey(e.target.value)}
          placeholder={travel.hotelbedsApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'Api key de developer.hotelbeds.com'}
        />
        <FormField
          id="hotelbedsSecret"
          label="Secret"
          type="password"
          value={hotelbedsSecret}
          onChange={(e) => setHotelbedsSecret(e.target.value)}
          placeholder={travel.hotelbedsSecretConfigurado ? PLACEHOLDER_CONFIGURADO : 'Secret compartido'}
        />
        <p className="text-xs text-slate-400">Las dos firman cada request (X-Signature) — sandbox de test, mismo host que producción.</p>

        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Moneda de venta</label>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                <option value="EUR">EUR (sin conversión — la nativa de Hotelbeds)</option>
                <option value="USD">USD</option>
                <option value="DOP">DOP</option>
              </Select>
            </div>
            {moneda !== 'EUR' && (
              <FormField
                label={`Tasa: 1 EUR = ? ${moneda}`}
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

        <Button type="submit" disabled={guardar.isPending || (moneda !== 'EUR' && !tasaCambio)}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

interface ResumenReconciliacionTravel {
  totalOrdenesRevisadas: number;
  ordenesHuerfanas: { id: string; localizador: string; montoTotal: string; moneda: string; creadaEn: string; canceladaEn: string | null }[];
  cancelacionesNoReflejadas: { ordenId: string; reservaId: string; tenantId: string; codigoInterno: string; canceladaEn: string }[];
}

/**
 * Duffel no expone el saldo real del Balance por API (confirmado contra
 * el sandbox real: /air/balances, /balances y /air/balance dan 404) —
 * esto NO compara números, cruza las órdenes reales de la cuenta contra
 * las TravelReserva internas para detectar huérfanas o cancelaciones que
 * el webhook no capturó. Nunca corrige nada solo, es un reporte.
 */
function SeccionTravelReconciliacion() {
  const [resultado, setResultado] = useState<ResumenReconciliacionTravel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revisar = useMutation({
    mutationFn: async () => (await platformApiClient.get<ResumenReconciliacionTravel>('/platform/travel/reconciliacion')).data,
    onSuccess: (data) => {
      setResultado(data);
      setError(null);
    },
    onError: () => setError('No se pudo revisar la cuenta de Duffel — intentá de nuevo en unos minutos.'),
  });

  return (
    <Card
      titulo="Reconciliación de la cuenta Duffel"
      descripcion="Cruza las órdenes reales de la cuenta compartida contra las reservas internas — no corrige nada solo, solo reporta."
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

function SeccionIaImagen({ config, guardar }: SeccionProps) {
  const iaImagen = config.iaImagen;
  const [proveedorActivo, setProveedorActivo] = useState(iaImagen.proveedorActivo ?? 'claude');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [claudeModelo, setClaudeModelo] = useState(iaImagen.claudeModelo ?? '');
  const [openaiModelo, setOpenaiModelo] = useState(iaImagen.openaiModelo ?? '');
  const [geminiModelo, setGeminiModelo] = useState(iaImagen.geminiModelo ?? '');
  // Auditoría de integraciones (2026-09) — antes sin ningún tope, a
  // diferencia del fondo de banner de abajo que sí lo tiene desde el día uno.
  const [limiteMensual, setLimiteMensual] = useState(String(iaImagen.limiteMensual));
  const [limiteAsistente, setLimiteAsistente] = useState(String(config.iaAsistente.limiteMensual));

  useEffect(() => {
    setProveedorActivo(iaImagen.proveedorActivo ?? 'claude');
    setClaudeModelo(iaImagen.claudeModelo ?? '');
    setOpenaiModelo(iaImagen.openaiModelo ?? '');
    setGeminiModelo(iaImagen.geminiModelo ?? '');
    setLimiteMensual(String(iaImagen.limiteMensual));
    setLimiteAsistente(String(config.iaAsistente.limiteMensual));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iaImagen.proveedorActivo, iaImagen.claudeModelo, iaImagen.openaiModelo, iaImagen.geminiModelo, iaImagen.limiteMensual, config.iaAsistente.limiteMensual]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      iaImagenProveedorActivo: proveedorActivo,
      iaClaudeModelo: claudeModelo,
      iaOpenaiModelo: openaiModelo,
      iaGeminiModelo: geminiModelo,
      iaImagenLimiteMensual: limiteMensual ? Number(limiteMensual) : undefined,
      iaAsistenteLimiteMensual: limiteAsistente ? Number(limiteAsistente) : undefined,
      ...(claudeApiKey !== '' ? { iaClaudeApiKey: claudeApiKey } : {}),
      ...(openaiApiKey !== '' ? { iaOpenaiApiKey: openaiApiKey } : {}),
      ...(geminiApiKey !== '' ? { iaGeminiApiKey: geminiApiKey } : {}),
    });
    setClaudeApiKey('');
    setOpenaiApiKey('');
    setGeminiApiKey('');
  }

  return (
    <Card
      titulo="IA para productos"
      descripcion='Analiza la foto de un producto y sugiere nombre/descripción — botón "Generar con IA" al crear un producto (requiere el permiso productos.ia_generar).'
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <div>
          <label htmlFor="iaProveedorActivo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Proveedor activo
          </label>
          <Select id="iaProveedorActivo" value={proveedorActivo} onChange={(e) => setProveedorActivo(e.target.value)}>
            <option value="claude">Claude (Anthropic)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="gemini">Google Gemini</option>
          </Select>
        </div>
        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Claude (Anthropic)</p>
            {proveedorActivo === 'claude' && <Badge tono="exito">Activo ahora</Badge>}
          </div>
          <FormField
            id="iaClaudeApiKey"
            label="Claude API Key"
            type="password"
            value={claudeApiKey}
            onChange={(e) => setClaudeApiKey(e.target.value)}
            placeholder={iaImagen.claudeApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'sk-ant-...'}
          />
          <SelectorModeloIa proveedor="claude" label="Modelo de Claude" value={claudeModelo} onChange={setClaudeModelo} cargarModelos={cargarModelosPlataforma} />
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">OpenAI</p>
            {proveedorActivo === 'openai' && <Badge tono="exito">Activo ahora</Badge>}
          </div>
          <FormField
            id="iaOpenaiApiKey"
            label="OpenAI API Key"
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder={iaImagen.openaiApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'sk-...'}
          />
          <SelectorModeloIa proveedor="openai" label="Modelo de OpenAI" value={openaiModelo} onChange={setOpenaiModelo} cargarModelos={cargarModelosPlataforma} />
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Gemini</p>
            {proveedorActivo === 'gemini' && <Badge tono="exito">Activo ahora</Badge>}
          </div>
          <FormField
            id="iaGeminiApiKey"
            label="Gemini API Key"
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder={iaImagen.geminiApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'AIza...'}
          />
          <SelectorModeloIa proveedor="gemini" label="Modelo de Gemini" value={geminiModelo} onChange={setGeminiModelo} cargarModelos={cargarModelosPlataforma} />
        </div>

        <FormField
          id="iaImagenLimiteMensual"
          label='Límite de "Generar con IA" (fotos de producto) por tenant por mes'
          type="number"
          min={0}
          value={limiteMensual}
          onChange={(e) => setLimiteMensual(e.target.value)}
        />
        <FormField
          id="iaAsistenteLimiteMensual"
          label="Límite del asistente de IA (sugerir cuenta contable, descripciones) por tenant por mes"
          type="number"
          min={0}
          value={limiteAsistente}
          onChange={(e) => setLimiteAsistente(e.target.value)}
        />

        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

/**
 * Publicaciones Sociales (Fase 2) — generación del FONDO del banner por
 * IA (imagen + prompt -> imagen nueva; el texto/precio lo dibuja Canvas
 * aparte). Reusa las API keys de OpenAI/Gemini ya cargadas arriba en
 * "IA para productos" — Claude no participa, no genera imágenes.
 */
function SeccionIaFondo({ config, guardar }: SeccionProps) {
  const iaFondo = config.iaFondo;
  const iaImagen = config.iaImagen;
  const [proveedorActivo, setProveedorActivo] = useState(iaFondo.proveedorActivo ?? 'gemini');
  const [openaiModelo, setOpenaiModelo] = useState(iaFondo.openaiModelo ?? '');
  const [geminiModelo, setGeminiModelo] = useState(iaFondo.geminiModelo ?? '');
  const [limiteMensual, setLimiteMensual] = useState(String(iaFondo.limiteMensual));

  useEffect(() => {
    setProveedorActivo(iaFondo.proveedorActivo ?? 'gemini');
    setOpenaiModelo(iaFondo.openaiModelo ?? '');
    setGeminiModelo(iaFondo.geminiModelo ?? '');
    setLimiteMensual(String(iaFondo.limiteMensual));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iaFondo.proveedorActivo, iaFondo.openaiModelo, iaFondo.geminiModelo, iaFondo.limiteMensual]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      iaFondoProveedorActivo: proveedorActivo,
      iaOpenaiModeloFondo: openaiModelo,
      iaGeminiModeloFondo: geminiModelo,
      iaFondoLimiteMensual: limiteMensual ? Number(limiteMensual) : undefined,
    });
  }

  return (
    <Card
      titulo="Generación de fondo (Publicaciones Sociales)"
      descripcion="Genera el fondo/ambientación del banner a partir de la foto real del producto + un prompt — el nombre y el precio se siguen dibujando exactos, nunca los escribe la IA. Usa las API keys de OpenAI/Gemini ya guardadas arriba."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <div>
          <label htmlFor="iaFondoProveedorActivo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Proveedor activo
          </label>
          <Select id="iaFondoProveedorActivo" value={proveedorActivo} onChange={(e) => setProveedorActivo(e.target.value)}>
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI</option>
          </Select>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Google Gemini</p>
            {proveedorActivo === 'gemini' && <Badge tono="exito">Activo ahora</Badge>}
            {!iaImagen.geminiApiKeyConfigurado && <Badge tono="advertencia">Falta la API key de arriba</Badge>}
          </div>
          <SelectorModeloIa proveedor="gemini" label="Modelo de generación (Gemini)" value={geminiModelo} onChange={setGeminiModelo} cargarModelos={cargarModelosFondo} />
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">OpenAI</p>
            {proveedorActivo === 'openai' && <Badge tono="exito">Activo ahora</Badge>}
            {!iaImagen.openaiApiKeyConfigurado && <Badge tono="advertencia">Falta la API key de arriba</Badge>}
          </div>
          <SelectorModeloIa proveedor="openai" label="Modelo de generación (OpenAI)" value={openaiModelo} onChange={setOpenaiModelo} cargarModelos={cargarModelosFondo} />
        </div>

        <FormField
          id="iaFondoLimiteMensual"
          label="Límite de generaciones con IA por tenant por mes"
          type="number"
          min={0}
          value={limiteMensual}
          onChange={(e) => setLimiteMensual(e.target.value)}
        />

        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

function SeccionWebhook({ config, guardar }: SeccionProps) {
  const webhook = config.webhook;
  const [webhookUrl, setWebhookUrl] = useState(webhook.url ?? '');
  const [webhookActivo, setWebhookActivo] = useState(webhook.activo);
  const [webhookSecret, setWebhookSecret] = useState('');

  useEffect(() => {
    setWebhookUrl(webhook.url ?? '');
    setWebhookActivo(webhook.activo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webhook.url, webhook.activo]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      webhookUrl,
      webhookActivo,
      ...(webhookSecret !== '' ? { webhookSecret } : {}),
    });
    setWebhookSecret('');
  }

  return (
    <Card
      titulo="Webhook (n8n u otro sistema externo)"
      descripcion="Destino de las reglas de notificación de vencimiento con canal Webhook — ver la pestaña Vencimientos."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Activo</span>
          <Switch activo={webhookActivo} onChange={setWebhookActivo} />
        </div>
        <FormField
          id="webhookUrl"
          label="URL del webhook"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://n8n.midominio.com/webhook/..."
        />
        <FormField
          id="webhookSecret"
          label="Secreto (firma de la petición)"
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={webhook.secretConfigurado ? PLACEHOLDER_CONFIGURADO : ''}
        />
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

/**
 * Credenciales de la API de Nginx Proxy Manager (puerto 81, la misma que
 * usa su UI) — usadas para crear el Proxy Host + certificado cuando el
 * super admin asigna un dominio propio a la tienda de un tenant (ver
 * "Dominios" en /plataforma/tenants). `npmForwardHost`/`npmForwardPort`
 * es el mismo destino interno que ya usa el Proxy Host de
 * app.ciguadev.com en NPM.
 */
function SeccionDominioPropio({ config, guardar }: SeccionProps) {
  const npm = config.dominioPropio;
  const [npmBaseUrl, setNpmBaseUrl] = useState(npm.npmBaseUrl ?? '');
  const [npmUsuario, setNpmUsuario] = useState(npm.npmUsuario ?? '');
  const [npmPassword, setNpmPassword] = useState('');
  const [npmForwardHost, setNpmForwardHost] = useState(npm.npmForwardHost ?? '');
  const [npmForwardPort, setNpmForwardPort] = useState(npm.npmForwardPort?.toString() ?? '');
  const [npmPublicHost, setNpmPublicHost] = useState(npm.npmPublicHost ?? '');

  useEffect(() => {
    setNpmBaseUrl(npm.npmBaseUrl ?? '');
    setNpmUsuario(npm.npmUsuario ?? '');
    setNpmForwardHost(npm.npmForwardHost ?? '');
    setNpmForwardPort(npm.npmForwardPort?.toString() ?? '');
    setNpmPublicHost(npm.npmPublicHost ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npm.npmBaseUrl, npm.npmUsuario, npm.npmForwardHost, npm.npmForwardPort, npm.npmPublicHost]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      npmBaseUrl,
      npmUsuario,
      npmForwardHost,
      npmForwardPort: npmForwardPort ? Number(npmForwardPort) : undefined,
      npmPublicHost,
      ...(npmPassword !== '' ? { npmPassword } : {}),
    });
    setNpmPassword('');
  }

  return (
    <Card
      titulo="Dominio propio de tenant (Nginx Proxy Manager)"
      descripcion="Credenciales de la API de NPM — necesarias para que el super admin pueda asignar dominios propios a la tienda de un tenant desde /plataforma/tenants."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <FormField
          id="npmBaseUrl"
          label="URL base de la API de NPM"
          value={npmBaseUrl}
          onChange={(e) => setNpmBaseUrl(e.target.value)}
          placeholder="http://10.0.10.10:81"
        />
        <FormField id="npmUsuario" label="Usuario" value={npmUsuario} onChange={(e) => setNpmUsuario(e.target.value)} placeholder="admin@ciguadev.com" />
        <FormField
          id="npmPassword"
          label="Contraseña"
          type="password"
          value={npmPassword}
          onChange={(e) => setNpmPassword(e.target.value)}
          placeholder={npm.npmPasswordConfigurado ? PLACEHOLDER_CONFIGURADO : ''}
        />
        <FormField
          id="npmForwardHost"
          label="Host de destino interno"
          value={npmForwardHost}
          onChange={(e) => setNpmForwardHost(e.target.value)}
          placeholder="Mismo destino que ya usa el Proxy Host de app.ciguadev.com"
        />
        <FormField
          id="npmForwardPort"
          label="Puerto de destino interno"
          type="number"
          value={npmForwardPort}
          onChange={(e) => setNpmForwardPort(e.target.value)}
          placeholder="8291"
        />
        <FormField
          id="npmPublicHost"
          label="Destino público (a esto el tenant apunta su DNS)"
          value={npmPublicHost}
          onChange={(e) => setNpmPublicHost(e.target.value)}
          placeholder="app.ciguadev.com o la IP pública del servidor"
        />
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}

/** Fase 4 — reglas de notificación de vencimiento + umbral de auto-suspensión (días de mora). */
function SeccionVencimientos({ config, guardar }: SeccionProps) {
  const queryClient = useQueryClient();
  const [diasParaAutoSuspender, setDiasParaAutoSuspender] = useState(String(config.autoSuspension.diasParaAutoSuspender));

  useEffect(() => {
    setDiasParaAutoSuspender(String(config.autoSuspension.diasParaAutoSuspender));
  }, [config.autoSuspension.diasParaAutoSuspender]);

  function onSubmitSuspension(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({ diasParaAutoSuspender: Number(diasParaAutoSuspender) });
  }

  const { data: reglas } = useQuery({
    queryKey: ['reglas-notificacion-vencimiento'],
    queryFn: async () => (await platformApiClient.get<ReglaNotificacion[]>('/platform/configuracion/reglas-notificacion')).data,
  });

  const [offsetDias, setOffsetDias] = useState('');
  const [canal, setCanal] = useState<'EMAIL' | 'WEBHOOK' | 'WHATSAPP'>('EMAIL');

  const crearRegla = useMutation({
    mutationFn: async () => platformApiClient.post('/platform/configuracion/reglas-notificacion', { offsetDias: Number(offsetDias), canal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reglas-notificacion-vencimiento'] });
      setOffsetDias('');
    },
  });

  const toggleRegla = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) =>
      platformApiClient.patch(`/platform/configuracion/reglas-notificacion/${id}`, { activa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reglas-notificacion-vencimiento'] }),
  });

  const eliminarRegla = useMutation({
    mutationFn: async (id: string) => platformApiClient.delete(`/platform/configuracion/reglas-notificacion/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reglas-notificacion-vencimiento'] }),
  });

  function onSubmitRegla(e: FormEvent) {
    e.preventDefault();
    if (!offsetDias) return;
    crearRegla.mutate();
  }

  return (
    <div className="space-y-6">
      <Card
        titulo="Auto-suspensión de tenants morosos"
        descripcion="Días de mora (factura vencida sin pago) antes de suspender automáticamente el acceso del tenant."
      >
        <form onSubmit={onSubmitSuspension} className="flex max-w-xs items-end gap-2">
          <FormField
            id="diasParaAutoSuspender"
            label="Días de mora"
            type="number"
            min={1}
            value={diasParaAutoSuspender}
            onChange={(e) => setDiasParaAutoSuspender(e.target.value)}
          />
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Card>

      <Card
        titulo="Reglas de notificación de vencimiento"
        descripcion='Offset negativo = aviso antes del vencimiento; positivo = después (mora). Ej. "-3" avisa 3 días antes; "5" avisa 5 días después de vencida.'
      >
        <div className="space-y-4">
          <form onSubmit={onSubmitRegla} className="flex items-end gap-2">
            <FormField
              id="regla-offset"
              label="Offset (días)"
              type="number"
              value={offsetDias}
              onChange={(e) => setOffsetDias(e.target.value)}
              placeholder="ej. -3"
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="regla-canal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Canal
              </label>
              <Select id="regla-canal" value={canal} onChange={(e) => setCanal(e.target.value as 'EMAIL' | 'WEBHOOK' | 'WHATSAPP')}>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="WEBHOOK">Webhook</option>
              </Select>
            </div>
            <Button type="submit" disabled={crearRegla.isPending}>
              {crearRegla.isPending ? 'Agregando…' : 'Agregar regla'}
            </Button>
          </form>

          {reglas?.length === 0 ? (
            <p className="text-sm text-slate-500">Sin reglas configuradas — no se envía ningún aviso de vencimiento.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full max-w-xl text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1.5 font-medium">Offset</th>
                  <th className="py-1.5 font-medium">Canal</th>
                  <th className="py-1.5 font-medium">Activa</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reglas?.map((regla) => (
                  <tr key={regla.id}>
                    <td className="py-1.5">{regla.offsetDias < 0 ? `${Math.abs(regla.offsetDias)} día(s) antes` : regla.offsetDias === 0 ? 'El mismo día' : `${regla.offsetDias} día(s) después`}</td>
                    <td className="py-1.5">{regla.canal === 'EMAIL' ? 'Email' : regla.canal === 'WHATSAPP' ? 'WhatsApp' : 'Webhook'}</td>
                    <td className="py-1.5">
                      <Switch activo={regla.activa} onChange={(v) => toggleRegla.mutate({ id: regla.id, activa: v })} />
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => eliminarRegla.mutate(regla.id)}
                        className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
