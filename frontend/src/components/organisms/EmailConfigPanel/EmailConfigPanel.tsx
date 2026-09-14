import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Switch } from '../../atoms/Switch/Switch';
import { FormField } from '../../molecules/FormField/FormField';

const PLACEHOLDER_CONFIGURADO = '•••••••• (configurado)';

interface EmailConfigTenant {
  habilitado: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPasswordConfigurado: boolean;
  smtpFrom: string | null;
}

/**
 * SMTP propio del tenant (mismo criterio de secretos que WhatsappConfigPanel/
 * PlatformConfiguracion: nunca se muestra en claro, solo "configurado:
 * true/false"; dejar la contraseña vacía al guardar no borra la ya
 * guardada). Cuando está habilitado y con host cargado, TODO el correo de
 * este tenant (factura/cotización al cliente, alertas de propiedades,
 * recuperación de contraseña, códigos de autorización, reporte de
 * incentivos) sale desde acá en vez del SMTP compartido de Plataforma —
 * para que las respuestas del destinatario lleguen a la bandeja real del
 * tenant. Sin SMTP propio configurado, todo sigue igual que hoy (SMTP de
 * Plataforma).
 */
export function EmailConfigPanel() {
  const queryClient = useQueryClient();
  const [habilitado, setHabilitado] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: config } = useQuery({
    queryKey: ['email-config'],
    queryFn: async () => (await apiClient.get<EmailConfigTenant>('/admin/email-config')).data,
  });

  useEffect(() => {
    if (!config) return;
    setHabilitado(config.habilitado);
    setSmtpHost(config.smtpHost ?? '');
    setSmtpPort(config.smtpPort?.toString() ?? '');
    setSmtpUser(config.smtpUser ?? '');
    setSmtpFrom(config.smtpFrom ?? '');
  }, [config]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch('/admin/email-config', {
        habilitado,
        smtpHost,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpUser,
        smtpFrom,
        ...(smtpPassword !== '' ? { smtpPassword } : {}),
      }),
    onSuccess: () => {
      setSmtpPassword('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['email-config'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la configuración.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <Card
      titulo="Correo (SMTP)"
      descripcion="Tu propio servidor de correo — sin configurarlo, tus envíos (facturas, cotizaciones, alertas) siguen saliendo del SMTP compartido de la plataforma. Al activarlo, las respuestas de tus clientes llegan a tu propia bandeja."
    >
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Habilitado</span>
          <Switch activo={habilitado} onChange={setHabilitado} />
        </div>
        <FormField id="email-smtp-host" label="Host SMTP" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
        <FormField id="email-smtp-port" label="Puerto" type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
        <FormField id="email-smtp-user" label="Usuario" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
        <FormField
          id="email-smtp-password"
          label="Contraseña"
          type="password"
          value={smtpPassword}
          onChange={(e) => setSmtpPassword(e.target.value)}
          placeholder={config?.smtpPasswordConfigurado ? PLACEHOLDER_CONFIGURADO : ''}
        />
        <FormField id="email-smtp-from" label="Remitente (From)" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Card>
  );
}
