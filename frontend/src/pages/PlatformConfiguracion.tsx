import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Switch } from '../components/atoms/Switch/Switch';
import { PlatformHeader } from '../components/organisms/PlatformHeader/PlatformHeader';

interface ConfiguracionPlataforma {
  general: { nombreNegocio: string | null };
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
}

const PLACEHOLDER_CONFIGURADO = '•••••••• (configurado)';

const TABS = ['General', 'Notificaciones', 'Pasarela de pago', 'Webhook'] as const;
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
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <PlatformHeader titulo="Configuración" />

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
          {tab === 'Notificaciones' && <SeccionNotificaciones config={config} guardar={guardar} />}
          {tab === 'Pasarela de pago' && <SeccionPasarela config={config} guardar={guardar} />}
          {tab === 'Webhook' && <SeccionWebhook config={config} guardar={guardar} />}
        </>
      )}
    </div>
  );
}

interface SeccionProps {
  config: ConfiguracionPlataforma;
  guardar: ReturnType<typeof useMutation<unknown, unknown, Record<string, unknown>>>;
}

function SeccionGeneral({ config, guardar }: SeccionProps) {
  const [nombreNegocio, setNombreNegocio] = useState(config.general.nombreNegocio ?? '');

  useEffect(() => setNombreNegocio(config.general.nombreNegocio ?? ''), [config.general.nombreNegocio]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate({ nombreNegocio });
  }

  return (
    <Card
      titulo="Datos generales"
      descripcion="Nombre de la plataforma usado en correos y comunicaciones (ej. recuperación de contraseña)."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <FormField
          id="nombreNegocio"
          label="Nombre de la plataforma"
          value={nombreNegocio}
          onChange={(e) => setNombreNegocio(e.target.value)}
          placeholder="El Sistema del Sol"
        />
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
    <Card titulo="Webhook (n8n u otro sistema externo)" descripcion="Solo guarda el dato de conexión — el disparo de eventos hacia este webhook se conecta en una fase posterior.">
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
