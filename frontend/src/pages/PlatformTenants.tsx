import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Switch } from '../components/atoms/Switch/Switch';
import { Modal } from '../components/molecules/Modal/Modal';

interface Tenant {
  id: string;
  nombre: string;
  subdominio: string;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';
  planId: string | null;
  plan: { id: string; nombre: string } | null;
  createdAt: string;
}

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
}

interface ModuloTenant {
  clave: string;
  nombre: string;
  activo: boolean;
  origen: 'plan' | 'override';
}

const TONO_POR_ESTADO: Record<Tenant['estado'], 'exito' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  SUSPENDIDO: 'advertencia',
  CANCELADO: 'peligro',
};

interface Suscripcion {
  id: string;
  estado: 'ACTIVA' | 'CANCELADA';
  fechaProximoCorte: string;
  feeMoraPct: string;
  plan: { nombre: string; precio: string; cicloFacturacion: 'MENSUAL' | 'ANUAL' };
}

const ETIQUETA_CICLO: Record<'MENSUAL' | 'ANUAL', string> = { MENSUAL: 'mes', ANUAL: 'año' };

function PanelSuscripcionTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [feeMoraPct, setFeeMoraPct] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);

  const { data: suscripcion } = useQuery({
    queryKey: ['platform-tenant-suscripcion', tenant.id],
    queryFn: async () => (await platformApiClient.get<Suscripcion>(`/platform/tenants/${tenant.id}/suscripcion`)).data,
  });

  useEffect(() => {
    if (suscripcion) setFeeMoraPct(suscripcion.feeMoraPct);
  }, [suscripcion]);

  const actualizar = useMutation({
    mutationFn: async (data: { feeMoraPct?: number; estado?: 'ACTIVA' | 'CANCELADA' }) =>
      platformApiClient.patch(`/platform/tenants/${tenant.id}/suscripcion`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-suscripcion', tenant.id] }),
  });

  const generarFactura = useMutation({
    mutationFn: async () => platformApiClient.post(`/platform/tenants/${tenant.id}/suscripcion/generar-factura`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
      setMensaje('Factura generada correctamente.');
    },
    onError: () => setMensaje('No se pudo generar la factura.'),
  });

  if (!suscripcion) {
    return (
      <Modal titulo={`Suscripción — ${tenant.nombre}`} onClose={onClose}>
        <p className="text-sm text-slate-400">Cargando…</p>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Suscripción — ${tenant.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
          <p>
            Plan: <span className="font-medium">{suscripcion.plan.nombre}</span> — RD${' '}
            {Number(suscripcion.plan.precio).toLocaleString('es-DO')} / {ETIQUETA_CICLO[suscripcion.plan.cicloFacturacion]}
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Próximo corte: {new Date(suscripcion.fechaProximoCorte).toLocaleDateString('es-DO')}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado de la suscripción</span>
          <Switch
            activo={suscripcion.estado === 'ACTIVA'}
            disabled={actualizar.isPending}
            onChange={(valor) => actualizar.mutate({ estado: valor ? 'ACTIVA' : 'CANCELADA' })}
          />
        </div>

        <div>
          <label htmlFor="fee-mora" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            % de mora (aplicado una vez al vencerse sin pago)
          </label>
          <div className="flex gap-2">
            <input
              id="fee-mora"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={feeMoraPct}
              onChange={(e) => setFeeMoraPct(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <Button
              variante="secundario"
              disabled={actualizar.isPending}
              onClick={() => actualizar.mutate({ feeMoraPct: Number(feeMoraPct) })}
            >
              Guardar
            </Button>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800" />

        <Button
          className="w-full"
          disabled={generarFactura.isPending}
          onClick={() => generarFactura.mutate()}
        >
          {generarFactura.isPending ? 'Generando…' : 'Generar factura ahora'}
        </Button>
        {mensaje && <p className="text-sm text-slate-500 dark:text-slate-400">{mensaje}</p>}
      </div>
    </Modal>
  );
}

function PanelModulosTenant({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: modulos } = useQuery({
    queryKey: ['platform-tenant-modulos', tenant.id],
    queryFn: async () => (await platformApiClient.get<ModuloTenant[]>(`/platform/tenants/${tenant.id}/modulos`)).data,
  });

  const actualizarOverride = useMutation({
    mutationFn: async ({ clave, activo }: { clave: string; activo: boolean | null }) =>
      platformApiClient.patch(`/platform/tenants/${tenant.id}/modulos/${clave}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenant-modulos', tenant.id] }),
  });

  return (
    <Modal titulo={`Módulos — ${tenant.nombre}`} onClose={onClose}>
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
        <span className="text-slate-500 dark:text-slate-400">Plan:</span>
        <Badge tono="neutro">{tenant.plan?.nombre ?? 'Sin plan'}</Badge>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Los módulos marcados como &quot;excepción&quot; no vienen del plan — fueron activados o desactivados puntualmente
        para este tenant.
      </p>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {modulos?.map((modulo) => (
          <div
            key={modulo.clave}
            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{modulo.nombre}</p>
              <p className="text-xs text-slate-400">
                {modulo.origen === 'override' ? 'Excepción para este tenant' : 'Heredado del plan'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {modulo.origen === 'override' && (
                <button
                  type="button"
                  className="text-xs text-sol-600 hover:underline dark:text-sol-400"
                  onClick={() => actualizarOverride.mutate({ clave: modulo.clave, activo: null })}
                >
                  Quitar excepción
                </button>
              )}
              <Switch
                activo={modulo.activo}
                disabled={actualizarOverride.isPending}
                onChange={(valor) => actualizarOverride.mutate({ clave: modulo.clave, activo: valor })}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function PlatformTenants() {
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState('');
  const [subdominio, setSubdominio] = useState('');
  const [rnc, setRnc] = useState('');
  const [planId, setPlanId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tenantModulos, setTenantModulos] = useState<Tenant | null>(null);
  const [tenantSuscripcion, setTenantSuscripcion] = useState<Tenant | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  const { data: planes } = useQuery({
    queryKey: ['platform-planes'],
    queryFn: async () => (await platformApiClient.get<Plan[]>('/platform/planes')).data,
  });

  const crearTenant = useMutation({
    mutationFn: async () =>
      platformApiClient.post('/platform/tenants', {
        nombre,
        subdominio,
        rnc: rnc || undefined,
        planId,
        adminEmail,
        adminNombre,
        adminPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
      setNombre('');
      setSubdominio('');
      setRnc('');
      setPlanId('');
      setAdminEmail('');
      setAdminNombre('');
      setAdminPassword('');
      setError(null);
    },
    onError: () => setError('No se pudo crear el tenant. Revisa que el subdominio no esté repetido y que el plan sea válido.'),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Tenant['estado'] }) =>
      platformApiClient.patch(`/platform/tenants/${id}`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  const cambiarPlan = useMutation({
    mutationFn: async ({ id, planId: nuevoPlanId }: { id: string; planId: string }) =>
      platformApiClient.patch(`/platform/tenants/${id}`, { planId: nuevoPlanId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-tenants'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crearTenant.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tenants</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1" titulo="Nuevo tenant" descripcion="Provisiona una empresa nueva con su admin inicial.">
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField id="nombre" label="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <FormField id="subdominio" label="Subdominio" value={subdominio} onChange={(e) => setSubdominio(e.target.value)} required />
            <FormField id="rnc" label="RNC (opcional)" value={rnc} onChange={(e) => setRnc(e.target.value)} />
            <div>
              <label htmlFor="plan" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Plan
              </label>
              <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
                <option value="" disabled>
                  Selecciona un plan
                </option>
                {planes?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <hr className="border-slate-200 dark:border-slate-800" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Usuario administrador inicial</p>
            <FormField id="adminNombre" label="Nombre" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} required />
            <FormField id="adminEmail" label="Email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
            <FormField id="adminPassword" label="Contraseña" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={8} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={crearTenant.isPending} className="w-full">
              {crearTenant.isPending ? 'Creando…' : 'Crear tenant'}
            </Button>
          </form>
        </Card>

        <Card
          className="lg:col-span-2"
          sinPadding
          titulo="Tenants"
          descripcion={tenants ? `${tenants.length} empresa(s) registradas` : undefined}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Subdominio</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenants?.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{tenant.nombre}</td>
                    <td className="px-5 py-3 font-mono text-xs">{tenant.subdominio}</td>
                    <td className="px-5 py-3">
                      <Select
                        value={tenant.planId ?? ''}
                        disabled={cambiarPlan.isPending}
                        onChange={(e) => cambiarPlan.mutate({ id: tenant.id, planId: e.target.value })}
                        className="!w-auto py-1"
                      >
                        <option value="" disabled>
                          Sin plan
                        </option>
                        {planes?.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.nombre}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_POR_ESTADO[tenant.estado]}>{tenant.estado}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Button variante="secundario" onClick={() => setTenantSuscripcion(tenant)}>
                          Suscripción
                        </Button>
                        <Button variante="secundario" onClick={() => setTenantModulos(tenant)}>
                          Ver módulos
                        </Button>
                        {tenant.estado === 'ACTIVO' ? (
                          <Button
                            variante="peligro"
                            onClick={() => cambiarEstado.mutate({ id: tenant.id, estado: 'SUSPENDIDO' })}
                          >
                            Suspender
                          </Button>
                        ) : (
                          <Button
                            variante="secundario"
                            onClick={() => cambiarEstado.mutate({ id: tenant.id, estado: 'ACTIVO' })}
                          >
                            Reactivar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {tenantModulos && <PanelModulosTenant tenant={tenantModulos} onClose={() => setTenantModulos(null)} />}
      {tenantSuscripcion && <PanelSuscripcionTenant tenant={tenantSuscripcion} onClose={() => setTenantSuscripcion(null)} />}
    </div>
  );
}
