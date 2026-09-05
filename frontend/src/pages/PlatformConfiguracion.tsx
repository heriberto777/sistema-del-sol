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
import { mensajeErrorApi } from '../lib/mensaje-error-api';

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

const TABS = ['General', 'NCF / e-CF', 'Notificaciones', 'Pasarela de pago', 'IA para productos', 'Webhook', 'Vencimientos', 'Dominio propio'] as const;
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

      <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
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
          {tab === 'IA para productos' && <SeccionIaImagen config={config} guardar={guardar} />}
          {tab === 'Webhook' && <SeccionWebhook config={config} guardar={guardar} />}
          {tab === 'Vencimientos' && <SeccionVencimientos config={config} guardar={guardar} />}
          {tab === 'Dominio propio' && <SeccionDominioPropio config={config} guardar={guardar} />}
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

  useEffect(() => {
    setNombreNegocio(config.general.nombreNegocio ?? '');
    setLogo(config.general.logo);
    setRnc(config.general.rnc ?? '');
    setDireccion(config.general.direccion ?? '');
    setTelefono(config.general.telefono ?? '');
    setEmail(config.general.email ?? '');
  }, [config.general.nombreNegocio, config.general.logo, config.general.rnc, config.general.direccion, config.general.telefono, config.general.email]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({ nombreNegocio, logo, rnc, direccion, telefono, email });
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

/**
 * Ítem "Generar con IA" (analizar la foto de un producto para sugerir
 * nombre/descripción) — mismo patrón que SeccionPasarela: un proveedor
 * "activo" + una llave por proveedor. `iaClaudeApiKey` es la MISMA
 * credencial que ya usa el resto de la IA de la plataforma
 * (`ANTHROPIC_API_KEY`) — no es una llave nueva y distinta.
 */
interface ModeloIa {
  id: string;
  nombre: string;
}

/**
 * Un <select> por el modelo real del proveedor en vez de texto libre —
 * "Cargar modelos" usa la API key ya guardada para consultar el propio
 * listado del proveedor (GET .../ia-imagen/modelos), así se elige de lo
 * que esa cuenta puede usar de verdad, sin riesgo de tipear mal el
 * nombre de un modelo o dejar uno viejo/descontinuado.
 */
function SelectorModeloIa({ proveedor, label, value, onChange }: { proveedor: string; label: string; value: string; onChange: (modelo: string) => void }) {
  const [modelos, setModelos] = useState<ModeloIa[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargarModelos = useMutation({
    mutationFn: async () =>
      (await platformApiClient.get<{ modelos: ModeloIa[] }>('/platform/configuracion/ia-imagen/modelos', { params: { proveedor } })).data.modelos,
    onSuccess: (lista) => {
      setError(null);
      setModelos(lista);
      if (lista.length > 0 && !lista.some((m) => m.id === value)) onChange(lista[0].id);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudieron cargar los modelos.')),
  });

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex items-center gap-2">
        <Select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1">
          {value && !modelos.some((m) => m.id === value) && <option value={value}>{value}</option>}
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </Select>
        <Button type="button" variante="secundario" onClick={() => cargarModelos.mutate()} disabled={cargarModelos.isPending}>
          {cargarModelos.isPending ? 'Cargando…' : 'Cargar modelos'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
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

  useEffect(() => {
    setProveedorActivo(iaImagen.proveedorActivo ?? 'claude');
    setClaudeModelo(iaImagen.claudeModelo ?? '');
    setOpenaiModelo(iaImagen.openaiModelo ?? '');
    setGeminiModelo(iaImagen.geminiModelo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iaImagen.proveedorActivo, iaImagen.claudeModelo, iaImagen.openaiModelo, iaImagen.geminiModelo]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({
      iaImagenProveedorActivo: proveedorActivo,
      iaClaudeModelo: claudeModelo,
      iaOpenaiModelo: openaiModelo,
      iaGeminiModelo: geminiModelo,
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
        <FormField
          id="iaClaudeApiKey"
          label="Claude API Key"
          type="password"
          value={claudeApiKey}
          onChange={(e) => setClaudeApiKey(e.target.value)}
          placeholder={iaImagen.claudeApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'sk-ant-...'}
        />
        <SelectorModeloIa proveedor="claude" label="Modelo de Claude" value={claudeModelo} onChange={setClaudeModelo} />
        <FormField
          id="iaOpenaiApiKey"
          label="OpenAI API Key"
          type="password"
          value={openaiApiKey}
          onChange={(e) => setOpenaiApiKey(e.target.value)}
          placeholder={iaImagen.openaiApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'sk-...'}
        />
        <SelectorModeloIa proveedor="openai" label="Modelo de OpenAI" value={openaiModelo} onChange={setOpenaiModelo} />
        <FormField
          id="iaGeminiApiKey"
          label="Gemini API Key"
          type="password"
          value={geminiApiKey}
          onChange={(e) => setGeminiApiKey(e.target.value)}
          placeholder={iaImagen.geminiApiKeyConfigurado ? PLACEHOLDER_CONFIGURADO : 'AIza...'}
        />
        <SelectorModeloIa proveedor="gemini" label="Modelo de Gemini" value={geminiModelo} onChange={setGeminiModelo} />
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
          )}
        </div>
      </Card>
    </div>
  );
}
